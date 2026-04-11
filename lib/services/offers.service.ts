import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOfferChatBody } from "@/lib/offers/chat-message";
import { MAX_OFFER_ROUNDS, canCreateOffer, canRespondToOfferTurn } from "@/lib/marketplace/rules";
import { createNotification } from "@/lib/notifications";
import { getOrCreateConversation, touchConversation } from "@/lib/services/conversations.service";

export type OfferAction = "accept" | "reject" | "counter";

export async function createOfferFlow(params: {
  supabase: SupabaseClient;
  listingId: string;
  offeredPrice: number;
  actorUserId: string;
}) {
  const { supabase, listingId, offeredPrice, actorUserId } = params;

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, title, seller_id, status, type, listing_type")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError || !listing) {
    throw new Error("El anuncio no existe.");
  }

  const listingCheck = canCreateOffer({ listing, currentUserId: actorUserId });
  if (!listingCheck.ok) {
    throw new Error(listingCheck.error);
  }

  const { data: existingOffer, error: existingOfferError } = await supabase
    .from("listing_offers")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", actorUserId)
    .eq("seller_id", listing.seller_id)
    .in("status", ["pending", "countered"])
    .maybeSingle();

  if (existingOfferError) {
    throw new Error(existingOfferError.message || "No se pudo comprobar la negociación activa.");
  }

  if (existingOffer) {
    throw new Error("Ya tienes una negociación activa para este anuncio.");
  }

  const now = new Date().toISOString();

  const { data: offer, error: offerError } = await supabase
    .from("listing_offers")
    .insert({
      listing_id: listingId,
      buyer_id: actorUserId,
      seller_id: listing.seller_id,
      offered_price: offeredPrice,
      current_amount: offeredPrice,
      current_actor: "seller",
      rounds_count: 1,
      status: "pending",
      counter_price: null,
      accepted_amount: null,
      responded_at: null,
    })
    .select(
      "id, listing_id, buyer_id, seller_id, offered_price, current_amount, current_actor, rounds_count, accepted_amount, status, counter_price, created_at, responded_at"
    )
    .single();

  if (offerError || !offer) {
    throw new Error(offerError?.message || "No se pudo crear la oferta.");
  }

  const conversationId = await getOrCreateConversation({
    supabase,
    listingId,
    buyerId: actorUserId,
    sellerId: listing.seller_id,
  });

  const { data: event, error: eventError } = await supabase
    .from("listing_offer_events")
    .insert({
      offer_id: offer.id,
      conversation_id: conversationId,
      actor_id: actorUserId,
      actor_role: "buyer",
      event_type: "offer_created",
      amount: offeredPrice,
      round_number: 1,
      status_snapshot: "pending",
    })
    .select("id")
    .single();

  if (eventError || !event) {
    throw new Error(eventError?.message || "No se pudo registrar el historial de la oferta.");
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: actorUserId,
    body: buildOfferChatBody({
      eventId: event.id,
      offerId: offer.id,
      eventType: "offer_created",
      actorRole: "buyer",
      amount: offeredPrice,
      round: 1,
      status: "pending",
      currentActor: "seller",
    }),
  });

  await touchConversation(supabase, conversationId, now);

  await createNotification(supabase, {
    user_id: listing.seller_id,
    kind: "offer_received",
    title: "Has recibido una oferta",
    body: `${listing.title || "Un anuncio"} · ${offeredPrice.toFixed(2)} €`,
    href: `/messages/${conversationId}`,
    metadata: { listing_id: listingId, offer_id: offer.id, conversation_id: conversationId },
  });

  return { offerId: offer.id, conversationId };
}

export async function respondToOfferFlow(params: {
  supabase: SupabaseClient;
  offerId: string;
  action: OfferAction;
  actorUserId: string;
  counterPrice?: number | null;
}) {
  const { supabase, offerId, action, actorUserId, counterPrice } = params;

  const { data: offer, error: offerError } = await supabase
    .from("listing_offers")
    .select(
      "id, listing_id, buyer_id, seller_id, offered_price, current_amount, current_actor, rounds_count, accepted_amount, status, counter_price, created_at, responded_at"
    )
    .eq("id", offerId)
    .maybeSingle();

  if (offerError || !offer) {
    throw new Error(offerError?.message || "Oferta no encontrada.");
  }

  if (!offer.buyer_id || !offer.seller_id) {
    throw new Error("La oferta no es válida.");
  }

  if (!offer.status || !["pending", "countered"].includes(offer.status)) {
    throw new Error("Esta oferta ya no admite cambios.");
  }

  const turnCheck = canRespondToOfferTurn({
    buyerId: offer.buyer_id,
    sellerId: offer.seller_id,
    actorUserId,
    currentActor: offer.current_actor,
    status: offer.status,
  });

  if (!turnCheck.ok) {
    throw new Error(turnCheck.error);
  }

  const actingAsSeller = actorUserId === offer.seller_id;

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, title, status")
    .eq("id", offer.listing_id)
    .maybeSingle();

  if (listingError || !listing) {
    throw new Error(listingError?.message || "El anuncio no existe.");
  }

  const conversationId = await getOrCreateConversation({
    supabase,
    listingId: offer.listing_id,
    buyerId: offer.buyer_id,
    sellerId: offer.seller_id,
  });

  const now = new Date().toISOString();
  const currentAmount = Number(offer.current_amount ?? offer.counter_price ?? offer.offered_price ?? 0);
  const currentRound = Math.max(1, Number(offer.rounds_count || 1));
  const actorRole = actingAsSeller ? "seller" : "buyer";

  if (action === "accept") {
    const acceptedAmount = currentAmount;

    const { error: acceptError } = await supabase
      .from("listing_offers")
      .update({
        status: "accepted",
        accepted_amount: acceptedAmount,
        current_amount: acceptedAmount,
        current_actor: null,
        responded_at: now,
      })
      .eq("id", offerId);

    if (acceptError) {
      throw new Error(acceptError.message || "No se pudo aceptar la oferta.");
    }

    await supabase
      .from("listing_offers")
      .update({ status: "rejected", current_actor: null, responded_at: now })
      .eq("listing_id", offer.listing_id)
      .neq("id", offerId)
      .in("status", ["pending", "countered"]);

    await supabase.from("listings").update({ status: "reserved" }).eq("id", offer.listing_id);

    const { data: event, error: eventError } = await supabase
      .from("listing_offer_events")
      .insert({
        offer_id: offer.id,
        conversation_id: conversationId,
        actor_id: actorUserId,
        actor_role: actorRole,
        event_type: "accepted",
        amount: acceptedAmount,
        round_number: currentRound,
        status_snapshot: "accepted",
      })
      .select("id")
      .single();

    if (eventError || !event) {
      throw new Error(eventError?.message || "No se pudo registrar la aceptación.");
    }

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: actorUserId,
      body: buildOfferChatBody({
        eventId: event.id,
        offerId: offer.id,
        eventType: "accepted",
        actorRole,
        amount: acceptedAmount,
        round: currentRound,
        status: "accepted",
        currentActor: "closed",
      }),
    });

    await touchConversation(supabase, conversationId, now);

    await createNotification(supabase, {
      user_id: actingAsSeller ? offer.buyer_id : offer.seller_id,
      kind: "offer_accepted",
      title: "Oferta aceptada",
      body: `${listing.title || "El anuncio"} · ${acceptedAmount.toFixed(2)} €`,
      href: `/messages/${conversationId}`,
      metadata: { listing_id: offer.listing_id, offer_id: offer.id, conversation_id: conversationId },
    });

    return { conversationId };
  }

  if (action === "reject") {
    const { error: rejectError } = await supabase
      .from("listing_offers")
      .update({
        status: "rejected",
        current_actor: null,
        responded_at: now,
      })
      .eq("id", offerId);

    if (rejectError) {
      throw new Error(rejectError.message || "No se pudo rechazar la oferta.");
    }

    const { data: event, error: eventError } = await supabase
      .from("listing_offer_events")
      .insert({
        offer_id: offer.id,
        conversation_id: conversationId,
        actor_id: actorUserId,
        actor_role: actorRole,
        event_type: "rejected",
        amount: currentAmount,
        round_number: currentRound,
        status_snapshot: "rejected",
      })
      .select("id")
      .single();

    if (eventError || !event) {
      throw new Error(eventError?.message || "No se pudo registrar el rechazo.");
    }

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: actorUserId,
      body: buildOfferChatBody({
        eventId: event.id,
        offerId: offer.id,
        eventType: "rejected",
        actorRole,
        amount: currentAmount,
        round: currentRound,
        status: "rejected",
        currentActor: "closed",
      }),
    });

    await touchConversation(supabase, conversationId, now);

    await createNotification(supabase, {
      user_id: actingAsSeller ? offer.buyer_id : offer.seller_id,
      kind: "offer_rejected",
      title: "Negociación cerrada",
      body: `${listing.title || "El anuncio"} ya no tiene una negociación activa.`,
      href: `/messages/${conversationId}`,
      metadata: { listing_id: offer.listing_id, offer_id: offer.id, conversation_id: conversationId },
    });

    return { conversationId };
  }

  if (counterPrice == null || !Number.isFinite(counterPrice) || counterPrice <= 0) {
    throw new Error("La contraoferta no es válida.");
  }

  if (currentRound >= MAX_OFFER_ROUNDS) {
    throw new Error(`Se ha alcanzado el máximo de ${MAX_OFFER_ROUNDS} rondas. Solo puedes aceptar o rechazar esta negociación.`);
  }

  const nextRound = currentRound + 1;
  const nextStatus = actingAsSeller ? "countered" : "pending";
  const nextActor = actingAsSeller ? "buyer" : "seller";

  const updatePayload = actingAsSeller
    ? {
      status: nextStatus,
      counter_price: counterPrice,
      current_amount: counterPrice,
      current_actor: nextActor,
      rounds_count: nextRound,
      responded_at: now,
    }
    : {
      status: nextStatus,
      offered_price: counterPrice,
      counter_price: null,
      current_amount: counterPrice,
      current_actor: nextActor,
      rounds_count: nextRound,
      responded_at: now,
    };

  const { error: updateError } = await supabase.from("listing_offers").update(updatePayload).eq("id", offerId);

  if (updateError) {
    throw new Error(updateError.message || "No se pudo guardar la contraoferta.");
  }

  const { data: event, error: eventError } = await supabase
    .from("listing_offer_events")
    .insert({
      offer_id: offer.id,
      conversation_id: conversationId,
      actor_id: actorUserId,
      actor_role: actorRole,
      event_type: "counter_sent",
      amount: counterPrice,
      round_number: nextRound,
      status_snapshot: nextStatus,
    })
    .select("id")
    .single();

  if (eventError || !event) {
    throw new Error(eventError?.message || "No se pudo registrar la contraoferta.");
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: actorUserId,
    body: buildOfferChatBody({
      eventId: event.id,
      offerId: offer.id,
      eventType: "counter_sent",
      actorRole,
      amount: counterPrice,
      round: nextRound,
      status: nextStatus,
      currentActor: nextActor,
    }),
  });

  await touchConversation(supabase, conversationId, now);

  await createNotification(supabase, {
    user_id: actingAsSeller ? offer.buyer_id : offer.seller_id,
    kind: "offer_countered",
    title: actingAsSeller ? "Te han enviado una contraoferta" : "Tienes una nueva oferta",
    body: `${listing.title || "El anuncio"} · ${counterPrice.toFixed(2)} €`,
    href: `/messages/${conversationId}`,
    metadata: { listing_id: offer.listing_id, offer_id: offer.id, conversation_id: conversationId },
  });

  return { conversationId };
}
