import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildOfferChatBody, type OfferActorRole } from "@/lib/offers/chat-message";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const body = await request.json();
    const offerId = typeof body?.offerId === "string" ? body.offerId.trim() : "";
    const action = ["accept", "reject", "counter"].includes(body?.action) ? body.action : null;
    const counterPrice = body?.counterPrice == null ? null : Number(body.counterPrice);
    if (!offerId || !action) return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
    if (action === "counter" && (counterPrice == null || Number.isNaN(counterPrice) || counterPrice <= 0)) {
      return NextResponse.json({ error: "La contraoferta no es válida." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: offer } = await admin.from("listing_offers").select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, current_actor, rounds_count, accepted_amount, status, counter_price").eq("id", offerId).maybeSingle();
    if (!offer) return NextResponse.json({ error: "Oferta no encontrada." }, { status: 404 });
    if (![offer.buyer_id, offer.seller_id].includes(user.id)) return NextResponse.json({ error: "No puedes responder a esta oferta." }, { status: 403 });
    if (!["pending", "countered"].includes(offer.status || "")) return NextResponse.json({ error: "Esta oferta ya no admite cambios." }, { status: 400 });

    const actorRole: OfferActorRole = user.id === offer.buyer_id ? "buyer" : "seller";
    if (offer.current_actor !== actorRole) {
      return NextResponse.json({ error: "No es tu turno para responder a esta oferta." }, { status: 403 });
    }

    const { data: conversation } = await admin.from("conversations").select("id").eq("listing_id", offer.listing_id).eq("buyer_id", offer.buyer_id).eq("seller_id", offer.seller_id).maybeSingle();
    const conversationId = conversation?.id || null;
    const now = new Date().toISOString();
    const nextActor: OfferActorRole = actorRole === "buyer" ? "seller" : "buyer";
    const currentAmount = Number(offer.current_amount ?? offer.counter_price ?? offer.offered_price);

    if (action === "accept") {
      await admin.from("listing_offers").update({ status: "accepted", accepted_amount: currentAmount, current_actor: null, responded_at: now }).eq("id", offerId);
      await admin.from("listing_offers").update({ status: "rejected", current_actor: null, responded_at: now }).eq("listing_id", offer.listing_id).neq("id", offerId).in("status", ["pending", "countered"]);
      await admin.from("listings").update({ status: "reserved" }).eq("id", offer.listing_id);

      const { data: event } = await admin.from("listing_offer_events").insert({
        offer_id: offer.id,
        conversation_id: conversationId,
        actor_id: user.id,
        actor_role: actorRole,
        event_type: "accepted",
        amount: currentAmount,
        round_number: offer.rounds_count || 1,
        status_snapshot: "accepted",
      }).select("id").single();

      if (conversationId && event) {
        await admin.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body: buildOfferChatBody({
            eventId: event.id,
            offerId: offer.id,
            eventType: "accepted",
            actorRole,
            amount: currentAmount,
            round: offer.rounds_count || 1,
            status: "accepted",
            currentActor: "closed",
          }),
        });
        await admin.from("conversations").update({ updated_at: now }).eq("id", conversationId);
      }

      await admin.from("payment_intents").upsert({
        listing_id: offer.listing_id,
        conversation_id: conversationId,
        offer_id: offer.id,
        buyer_id: offer.buyer_id,
        seller_id: offer.seller_id,
        amount: currentAmount,
        currency: "EUR",
        provider: "stripe",
        status: "draft",
        updated_at: now,
      }, { onConflict: "offer_id" });

      const otherUserId = actorRole === "buyer" ? offer.seller_id : offer.buyer_id;
      await createNotification(admin, {
        user_id: otherUserId,
        kind: "offer_accepted",
        title: "Se ha aceptado la oferta",
        body: `${currentAmount.toFixed(2)} €`,
        href: conversationId ? `/messages/${conversationId}` : "/account/activity",
        metadata: { offer_id: offer.id, listing_id: offer.listing_id, conversation_id: conversationId },
      });

      return NextResponse.json({ ok: true, conversationId });
    }

    if (action === "reject") {
      await admin.from("listing_offers").update({ status: "rejected", current_actor: null, responded_at: now }).eq("id", offerId);

      const { data: event } = await admin.from("listing_offer_events").insert({
        offer_id: offer.id,
        conversation_id: conversationId,
        actor_id: user.id,
        actor_role: actorRole,
        event_type: "rejected",
        amount: currentAmount,
        round_number: offer.rounds_count || 1,
        status_snapshot: "rejected",
      }).select("id").single();

      if (conversationId && event) {
        await admin.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body: buildOfferChatBody({
            eventId: event.id,
            offerId: offer.id,
            eventType: "rejected",
            actorRole,
            amount: currentAmount,
            round: offer.rounds_count || 1,
            status: "rejected",
            currentActor: "closed",
          }),
        });
        await admin.from("conversations").update({ updated_at: now }).eq("id", conversationId);
      }

      const otherUserId = actorRole === "buyer" ? offer.seller_id : offer.buyer_id;
      await createNotification(admin, {
        user_id: otherUserId,
        kind: "offer_rejected",
        title: "Se ha rechazado la oferta",
        body: `${currentAmount.toFixed(2)} €`,
        href: conversationId ? `/messages/${conversationId}` : `/marketplace/listing/${offer.listing_id}`,
        metadata: { offer_id: offer.id, listing_id: offer.listing_id, conversation_id: conversationId },
      });

      return NextResponse.json({ ok: true, conversationId });
    }

    const nextRound = (offer.rounds_count || 1) + 1;
    if (nextRound > 10) return NextResponse.json({ error: "Se ha alcanzado el máximo de 10 rondas de negociación." }, { status: 400 });

    await admin.from("listing_offers").update({
      status: "countered",
      current_amount: counterPrice,
      counter_price: actorRole === "seller" ? counterPrice : offer.counter_price,
      current_actor: nextActor,
      rounds_count: nextRound,
      responded_at: now,
    }).eq("id", offerId);

    const { data: event } = await admin.from("listing_offer_events").insert({
      offer_id: offer.id,
      conversation_id: conversationId,
      actor_id: user.id,
      actor_role: actorRole,
      event_type: "counter_sent",
      amount: counterPrice,
      round_number: nextRound,
      status_snapshot: "countered",
    }).select("id").single();

    if (conversationId && event) {
      await admin.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: buildOfferChatBody({
          eventId: event.id,
          offerId: offer.id,
          eventType: "counter_sent",
          actorRole,
          amount: counterPrice || 0,
          round: nextRound,
          status: "countered",
          currentActor: nextActor,
        }),
      });
      await admin.from("conversations").update({ updated_at: now }).eq("id", conversationId);
    }

    const otherUserId = actorRole === "buyer" ? offer.seller_id : offer.buyer_id;
    await createNotification(admin, {
      user_id: otherUserId,
      kind: "offer_countered",
      title: actorRole === "seller" ? "Has recibido una contraoferta" : "Has recibido una nueva propuesta",
      body: `${(counterPrice || 0).toFixed(2)} €`,
      href: conversationId ? `/messages/${conversationId}` : "/account/activity",
      metadata: { offer_id: offer.id, listing_id: offer.listing_id, conversation_id: conversationId },
    });

    return NextResponse.json({ ok: true, conversationId });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || error?.details || "No se pudo responder a la oferta." }, { status: 500 });
  }
}
