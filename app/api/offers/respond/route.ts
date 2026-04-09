import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { buildOfferChatBody } from "@/lib/offers/chat-message";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const offerId = typeof body?.offerId === "string" ? body.offerId.trim() : "";
    const action = ["accept", "reject", "counter"].includes(body?.action) ? body.action : null;
    const counterPrice = body?.counterPrice == null ? null : Number(body.counterPrice);

    if (!offerId || !action) {
      return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
    }

    if (action === "counter" && (counterPrice == null || Number.isNaN(counterPrice) || counterPrice <= 0)) {
      return NextResponse.json({ error: "La contraoferta no es válida." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data: offer, error: offerError } = await adminSupabase
      .from("listing_offers")
      .select(
        "id, listing_id, buyer_id, seller_id, offered_price, current_amount, current_actor, rounds_count, accepted_amount, status, counter_price, created_at, responded_at"
      )
      .eq("id", offerId)
      .maybeSingle();

    if (offerError || !offer) {
      return NextResponse.json({ error: offerError?.message || "Oferta no encontrada." }, { status: 404 });
    }

    if (!["pending", "countered"].includes(offer.status || "")) {
      return NextResponse.json({ error: "Esta oferta ya no admite cambios." }, { status: 400 });
    }

    const actingAsSeller = user.id === offer.seller_id;
    const actingAsBuyer = user.id === offer.buyer_id;
    const currentTurn = offer.current_actor || (offer.status === "countered" ? "buyer" : "seller");

    if ((currentTurn === "seller" && !actingAsSeller) || (currentTurn === "buyer" && !actingAsBuyer)) {
      return NextResponse.json({ error: "No puedes responder a esta oferta en este momento." }, { status: 403 });
    }

    const { data: listing } = await adminSupabase
      .from("listings")
      .select("id, title")
      .eq("id", offer.listing_id)
      .maybeSingle();

    const { data: existingConversation } = await adminSupabase
      .from("conversations")
      .select("id")
      .eq("listing_id", offer.listing_id)
      .eq("buyer_id", offer.buyer_id)
      .eq("seller_id", offer.seller_id)
      .maybeSingle();

    let conversationId = existingConversation?.id || null;
    if (!conversationId) {
      const { data: newConversation, error: newConversationError } = await adminSupabase
        .from("conversations")
        .insert({
          listing_id: offer.listing_id,
          buyer_id: offer.buyer_id,
          seller_id: offer.seller_id,
        })
        .select("id")
        .single();

      if (newConversationError || !newConversation) {
        return NextResponse.json({ error: newConversationError?.message || "No se pudo abrir el chat." }, { status: 400 });
      }
      conversationId = newConversation.id;
    }

    if (conversationId) {
      await adminSupabase
        .from("hidden_conversations")
        .delete()
        .eq("conversation_id", conversationId)
        .in("user_id", [offer.buyer_id, offer.seller_id]);
    }

    const now = new Date().toISOString();
    const currentAmount = Number(offer.current_amount ?? offer.counter_price ?? offer.offered_price ?? 0);
    const currentRound = Math.max(1, Number(offer.rounds_count || 1));
    const actorRole = actingAsSeller ? "seller" : "buyer";

    if (action === "accept") {
      const acceptedAmount = currentAmount;

      await adminSupabase
        .from("listing_offers")
        .update({
          status: "accepted",
          accepted_amount: acceptedAmount,
          current_amount: acceptedAmount,
          current_actor: null,
          responded_at: now,
        })
        .eq("id", offerId);

      await adminSupabase
        .from("listing_offers")
        .update({ status: "rejected", current_actor: null, responded_at: now })
        .eq("listing_id", offer.listing_id)
        .neq("id", offerId)
        .in("status", ["pending", "countered"]);

      await adminSupabase.from("listings").update({ status: "reserved" }).eq("id", offer.listing_id);

      const { data: event, error: eventError } = await adminSupabase
        .from("listing_offer_events")
        .insert({
          offer_id: offer.id,
          conversation_id: conversationId,
          actor_id: user.id,
          actor_role: actorRole,
          event_type: "accepted",
          amount: acceptedAmount,
          round_number: currentRound,
          status_snapshot: "accepted",
        })
        .select("id")
        .single();

      if (eventError || !event) {
        return NextResponse.json({ error: eventError?.message || "No se pudo registrar la aceptación." }, { status: 400 });
      }

      if (conversationId) {
        await adminSupabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
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

        await adminSupabase.from("conversations").update({ updated_at: now }).eq("id", conversationId);
      }

      await createNotification(adminSupabase, {
        user_id: actingAsSeller ? offer.buyer_id : offer.seller_id,
        kind: "offer_accepted",
        title: "Oferta aceptada",
        body: `${listing?.title || "El anuncio"} · ${acceptedAmount.toFixed(2)} €`,
        href: conversationId ? `/messages/${conversationId}` : "/messages",
        metadata: { listing_id: offer.listing_id, offer_id: offer.id, conversation_id: conversationId },
      });

      return NextResponse.json({ ok: true, conversationId });
    }

    if (action === "reject") {
      await adminSupabase
        .from("listing_offers")
        .update({
          status: "rejected",
          current_actor: null,
          responded_at: now,
        })
        .eq("id", offerId);

      const { data: event, error: eventError } = await adminSupabase
        .from("listing_offer_events")
        .insert({
          offer_id: offer.id,
          conversation_id: conversationId,
          actor_id: user.id,
          actor_role: actorRole,
          event_type: "rejected",
          amount: currentAmount,
          round_number: currentRound,
          status_snapshot: "rejected",
        })
        .select("id")
        .single();

      if (eventError || !event) {
        return NextResponse.json({ error: eventError?.message || "No se pudo registrar el rechazo." }, { status: 400 });
      }

      if (conversationId) {
        await adminSupabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
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

        await adminSupabase.from("conversations").update({ updated_at: now }).eq("id", conversationId);
      }

      await createNotification(adminSupabase, {
        user_id: actingAsSeller ? offer.buyer_id : offer.seller_id,
        kind: "offer_rejected",
        title: "Negociación cerrada",
        body: `${listing?.title || "El anuncio"} ya no tiene una negociación activa.`,
        href: conversationId ? `/messages/${conversationId}` : "/messages",
        metadata: { listing_id: offer.listing_id, offer_id: offer.id, conversation_id: conversationId },
      });

      return NextResponse.json({ ok: true, conversationId });
    }

    if (currentRound >= 10) {
      return NextResponse.json(
        { error: "Se ha alcanzado el máximo de 10 rondas. Solo puedes aceptar o rechazar esta negociación." },
        { status: 400 }
      );
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

    const { error: updateError } = await adminSupabase
      .from("listing_offers")
      .update(updatePayload)
      .eq("id", offerId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message || "No se pudo guardar la contraoferta." }, { status: 400 });
    }

    const { data: event, error: eventError } = await adminSupabase
      .from("listing_offer_events")
      .insert({
        offer_id: offer.id,
        conversation_id: conversationId,
        actor_id: user.id,
        actor_role: actorRole,
        event_type: "counter_sent",
        amount: counterPrice,
        round_number: nextRound,
        status_snapshot: nextStatus,
      })
      .select("id")
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: eventError?.message || "No se pudo registrar la contraoferta." }, { status: 400 });
    }

    if (conversationId) {
      await adminSupabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: buildOfferChatBody({
          eventId: event.id,
          offerId: offer.id,
          eventType: "counter_sent",
          actorRole,
          amount: counterPrice || 0,
          round: nextRound,
          status: nextStatus,
          currentActor: nextActor,
        }),
      });
      await adminSupabase.from("conversations").update({ updated_at: now }).eq("id", conversationId);
    }

    await createNotification(adminSupabase, {
      user_id: actingAsSeller ? offer.buyer_id : offer.seller_id,
      kind: "offer_countered",
      title: actingAsSeller ? "Te han enviado una contraoferta" : "Tienes una nueva oferta",
      body: `${listing?.title || "El anuncio"} · ${(counterPrice || 0).toFixed(2)} €`,
      href: conversationId ? `/messages/${conversationId}` : "/messages",
      metadata: { listing_id: offer.listing_id, offer_id: offer.id, conversation_id: conversationId },
    });

    return NextResponse.json({ ok: true, conversationId });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || error?.details || "No se pudo responder a la oferta.",
      },
      { status: 500 }
    );
  }
}
