import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOfferChatBody } from "@/lib/offers/chat-message";
import { MAX_OFFER_ROUNDS, canCreateOffer, canRespondToOfferTurn } from "@/lib/marketplace/rules";
import { createNotification } from "@/lib/notifications";
import { getOrCreateConversation } from "@/lib/services/conversations.service";

export type OfferAction = "accept" | "reject" | "counter";

export class OfferCreationConflictError extends Error {
  constructor() { super("Otra negociación se ha iniciado. Actualiza el anuncio."); this.name = "OfferCreationConflictError"; }
}
export class OfferSideEffectReconciliationError extends Error {
  constructor() { super("La oferta se guardó, pero requiere conciliar el chat o los avisos."); this.name = "OfferSideEffectReconciliationError"; }
}


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
    throw new Error("No se pudo comprobar la negociación activa.");
  }

  if (existingOffer) {
    // Reuse the thread without reading an uninitialized conversationId.
    const existingConversationId = await getOrCreateConversation({
      supabase, listingId, buyerId: actorUserId, sellerId: listing.seller_id,
    });
    return { offerId: existingOffer.id, conversationId: existingConversationId, alreadyExists: true };
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

  if (offerError?.code === "23505") throw new OfferCreationConflictError();
  if (offerError || !offer) throw new Error("No se pudo crear la oferta.");

  // The offer has already been inserted. A failure now is partial success,
  // not a safe reason to let the client automatically repeat an INSERT.
  try {
    const conversationId = await getOrCreateConversation({
      supabase, listingId, buyerId: actorUserId, sellerId: listing.seller_id,
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
      .select("id").single();
    if (eventError || !event) throw new Error("offer_event_write_failed");

    const { error: messageError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: actorUserId,
      body: buildOfferChatBody({
        eventId: event.id, offerId: offer.id, eventType: "offer_created",
        actorRole: "buyer", amount: offeredPrice,
        round: 1, status: "pending", currentActor: "seller",
      }),
    });
    if (messageError) throw new Error("offer_message_write_failed");

    const { data: touched, error: touchError } = await supabase
      .from("conversations").update({ updated_at: now })
      .eq("id", conversationId).select("id").maybeSingle();
    if (touchError || !touched) throw new Error("offer_conversation_touch_failed");

    const { error: notificationError } = await createNotification(supabase, {
      user_id: listing.seller_id,
      kind: "offer_received",
      title: "Has recibido una oferta",
      body: `${listing.title || "Un anuncio"} · ${offeredPrice.toFixed(2)} €`,
      href: `/messages/${conversationId}`,
      metadata: { listing_id: listingId, offer_id: offer.id, conversation_id: conversationId },
    });
    if (notificationError) throw new Error("offer_notification_failed");

    return { offerId: offer.id, conversationId };
  } catch {
    throw new OfferSideEffectReconciliationError();
  }
}

export class OfferDecisionConflictError extends Error {
  constructor() {
    super("La oferta cambió de estado. Actualiza la negociación.");
    this.name = "OfferDecisionConflictError";
  }
}

export async function respondToOfferFlow(params: {
  supabase: SupabaseClient;
  offerId: string;
  action: OfferAction;
  actorUserId: string;
  counterPrice?: number | null;
}) {
  const { supabase, offerId, action, actorUserId, counterPrice } = params;
  if (!["accept", "reject", "counter"].includes(action)) throw new Error("Acción de oferta inválida.");

  const { data: offer, error: offerError } = await supabase
    .from("listing_offers")
    .select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, current_actor, rounds_count, accepted_amount, status, counter_price, created_at, responded_at")
    .eq("id", offerId).maybeSingle();
  if (offerError) throw new Error("No se pudo comprobar la oferta.");
  if (!offer || !offer.buyer_id || !offer.seller_id) throw new Error("La oferta no es válida.");
  if (!["pending", "countered"].includes(offer.status || "")) throw new OfferDecisionConflictError();

  const turnCheck = canRespondToOfferTurn({
    buyerId: offer.buyer_id, sellerId: offer.seller_id,
    actorUserId, currentActor: offer.current_actor, status: offer.status,
  });
  if (!turnCheck.ok) throw new Error(turnCheck.error);

  const { data: listing, error: listingError } = await supabase
    .from("listings").select("id, title, status")
    .eq("id", offer.listing_id).maybeSingle();
  if (listingError) throw new Error("No se pudo comprobar el anuncio.");
  if (!listing) throw new Error("El anuncio no existe.");
  if (action !== "reject" && listing.status !== "available") throw new OfferDecisionConflictError();

  const actingAsSeller = actorUserId === offer.seller_id;
  const actorRole = actingAsSeller ? "seller" : "buyer";
  const currentAmount = Number(offer.current_amount ?? offer.counter_price ?? offer.offered_price ?? 0);
  const currentRound = Math.max(1, Number(offer.rounds_count || 1));
  const now = new Date().toISOString();

  if (action === "counter") {
    if (counterPrice == null || !Number.isFinite(counterPrice) || counterPrice <= 0)
      throw new Error("La contraoferta no es válida.");
    if (currentRound >= MAX_OFFER_ROUNDS)
      throw new Error(`Se ha alcanzado el máximo de ${MAX_OFFER_ROUNDS} rondas. Solo puedes aceptar o rechazar esta negociación.`);
  }

  const nextRound = action === "counter" ? currentRound + 1 : currentRound;
  const nextStatus = action === "accept" ? "accepted"
    : action === "reject" ? "rejected" : actingAsSeller ? "countered" : "pending";
  const nextActor = action === "counter" ? (actingAsSeller ? "buyer" : "seller") : null;
  const amount = action === "counter" ? Number(counterPrice) : currentAmount;
  const payload = action === "counter"
    ? actingAsSeller
      ? { status: nextStatus, counter_price: counterPrice, current_amount: amount,
          current_actor: nextActor, rounds_count: nextRound, responded_at: now }
      : { status: nextStatus, offered_price: counterPrice, counter_price: null, current_amount: amount,
          current_actor: nextActor, rounds_count: nextRound, responded_at: now }
    : action === "accept"
      ? { status: "accepted", accepted_amount: currentAmount, current_amount: currentAmount,
          current_actor: null, responded_at: now }
      : { status: "rejected", current_actor: null, responded_at: now };

  // Compare-and-set protects against stale accept/reject/counter on the SAME offer.
  const { data: changed, error: changeError } = await supabase
    .from("listing_offers").update(payload).eq("id", offerId)
    .eq("status", offer.status).eq("rounds_count", offer.rounds_count)
    .select("id").maybeSingle();
  if (changeError) throw new Error("No se pudo guardar la decisión de oferta.");
  if (!changed) throw new OfferDecisionConflictError();

  // The offer decision is already durable. Any later failure is PARTIAL SUCCESS.
  // Never automatically replay the decision, message or notification.
  try {
    if (action === "accept") {
      const { error: competingError } = await supabase
        .from("listing_offers")
        .update({ status: "rejected", current_actor: null, responded_at: now })
        .eq("listing_id", offer.listing_id).neq("id", offerId)
        .in("status", ["pending", "countered"]);
      if (competingError) throw new Error("offer_competitors_not_confirmed");
      const { data: reserved, error: reserveError } = await supabase
        .from("listings").update({ status: "reserved" })
        .eq("id", offer.listing_id).eq("status", "available")
        .select("id").maybeSingle();
      if (reserveError || !reserved) throw new Error("offer_listing_reserve_not_confirmed");
    }

    const conversationId = await getOrCreateConversation({
      supabase, listingId: offer.listing_id,
      buyerId: offer.buyer_id, sellerId: offer.seller_id,
    });

    const eventType = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "counter_sent";
    const { data: event, error: eventError } = await supabase
      .from("listing_offer_events").insert({
        offer_id: offer.id, conversation_id: conversationId,
        actor_id: actorUserId, actor_role: actorRole,
        event_type: eventType, amount, round_number: nextRound,
        status_snapshot: nextStatus,
      }).select("id").single();
    if (eventError || !event) throw new Error("offer_event_not_confirmed");

    const { error: messageError } = await supabase.from("messages").insert({
      conversation_id: conversationId, sender_id: actorUserId,
      body: buildOfferChatBody({
        eventId: event.id, offerId: offer.id, eventType, actorRole,
        amount, round: nextRound, status: nextStatus,
        currentActor: nextActor || "closed",
      }),
    });
    if (messageError) throw new Error("offer_message_not_confirmed");

    const { data: touched, error: touchError } = await supabase
      .from("conversations").update({ updated_at: now })
      .eq("id", conversationId).select("id").maybeSingle();
    if (touchError || !touched) throw new Error("offer_chat_sync_not_confirmed");

    const recipientId = actingAsSeller ? offer.buyer_id : offer.seller_id;
    const title = action === "accept" ? "Oferta aceptada"
      : action === "reject" ? "Negociación cerrada"
      : actingAsSeller ? "Te han enviado una contraoferta" : "Tienes una nueva oferta";
    const body = action === "reject"
      ? `${listing.title || "El anuncio"} ya no tiene una negociación activa.`
      : `${listing.title || "El anuncio"} · ${amount.toFixed(2)} €`;
    const { error: notificationError } = await createNotification(supabase, {
      user_id: recipientId,
      kind: action === "accept" ? "offer_accepted" : action === "reject" ? "offer_rejected" : "offer_countered",
      title, body, href: `/messages/${conversationId}`,
      metadata: { listing_id: offer.listing_id, offer_id: offer.id, conversation_id: conversationId },
    });
    if (notificationError) throw new Error("offer_notification_not_confirmed");
    return { conversationId };
  } catch {
    throw new OfferSideEffectReconciliationError();
  }
}
