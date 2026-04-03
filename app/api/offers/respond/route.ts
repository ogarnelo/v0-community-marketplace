import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

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
    const action = ["accept", "reject", "counter"].includes(body?.action)
      ? body.action
      : null;
    const counterPrice = body?.counterPrice == null ? null : Number(body.counterPrice);

    if (!offerId || !action) {
      return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
    }

    if (action === "counter" && (counterPrice == null || Number.isNaN(counterPrice) || counterPrice <= 0)) {
      return NextResponse.json({ error: "La contraoferta no es válida." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: offer } = await adminSupabase
      .from("listing_offers")
      .select("id, listing_id, buyer_id, seller_id, offered_price, status, counter_price")
      .eq("id", offerId)
      .maybeSingle();

    if (!offer) {
      return NextResponse.json({ error: "Oferta no encontrada." }, { status: 404 });
    }

    if (offer.seller_id !== user.id) {
      return NextResponse.json({ error: "No puedes responder a esta oferta." }, { status: 403 });
    }

    const { data: existingConversation } = await adminSupabase
      .from("conversations")
      .select("id")
      .eq("listing_id", offer.listing_id)
      .eq("buyer_id", offer.buyer_id)
      .eq("seller_id", offer.seller_id)
      .maybeSingle();

    let conversationId = existingConversation?.id || null;

    if (!conversationId) {
      const { data: newConversation } = await adminSupabase
        .from("conversations")
        .insert({
          listing_id: offer.listing_id,
          buyer_id: offer.buyer_id,
          seller_id: offer.seller_id,
        })
        .select("id")
        .single();

      conversationId = newConversation?.id || null;
    }

    const now = new Date().toISOString();

    if (action === "accept") {
      await adminSupabase
        .from("listing_offers")
        .update({ status: "accepted", responded_at: now, counter_price: null })
        .eq("id", offerId);

      await adminSupabase
        .from("listing_offers")
        .update({ status: "rejected", responded_at: now })
        .eq("listing_id", offer.listing_id)
        .neq("id", offerId)
        .in("status", ["pending", "countered"]);

      await adminSupabase
        .from("listings")
        .update({ status: "reserved" })
        .eq("id", offer.listing_id);

      if (conversationId) {
        await adminSupabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: offer.seller_id,
          body: `✅ Oferta aceptada: ${offer.offered_price} €. Seguimos por aquí.`,
        });

        await adminSupabase
          .from("conversations")
          .update({ updated_at: now })
          .eq("id", conversationId);
      }

      await createNotification(adminSupabase, {
        user_id: offer.buyer_id,
        kind: "offer_accepted",
        title: "Han aceptado tu oferta",
        body: `Tu oferta de ${offer.offered_price} € ha sido aceptada.`,
        href: conversationId ? `/messages/${conversationId}` : "/messages",
        metadata: {
          offer_id: offer.id,
          listing_id: offer.listing_id,
          conversation_id: conversationId,
        },
      });

      return NextResponse.json({ ok: true, conversationId });
    }

    if (action === "reject") {
      await adminSupabase
        .from("listing_offers")
        .update({ status: "rejected", responded_at: now })
        .eq("id", offerId);

      if (conversationId) {
        await adminSupabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: offer.seller_id,
          body: "❌ Oferta rechazada.",
        });

        await adminSupabase
          .from("conversations")
          .update({ updated_at: now })
          .eq("id", conversationId);
      }

      await createNotification(adminSupabase, {
        user_id: offer.buyer_id,
        kind: "offer_rejected",
        title: "Han rechazado tu oferta",
        body: `Tu oferta de ${offer.offered_price} € no ha sido aceptada.`,
        href: conversationId ? `/messages/${conversationId}` : "/messages",
        metadata: {
          offer_id: offer.id,
          listing_id: offer.listing_id,
          conversation_id: conversationId,
        },
      });

      return NextResponse.json({ ok: true, conversationId });
    }

    await adminSupabase
      .from("listing_offers")
      .update({
        status: "countered",
        counter_price: counterPrice,
        responded_at: now,
      })
      .eq("id", offerId);

    if (conversationId) {
      await adminSupabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: offer.seller_id,
        body: `🔁 Contraoferta: ${counterPrice} €`,
      });

      await adminSupabase
        .from("conversations")
        .update({ updated_at: now })
        .eq("id", conversationId);
    }

    await createNotification(adminSupabase, {
      user_id: offer.buyer_id,
      kind: "offer_countered",
      title: "Has recibido una contraoferta",
      body: `Nueva contraoferta de ${counterPrice} € para el anuncio.`,
      href: conversationId ? `/messages/${conversationId}` : "/messages",
      metadata: {
        offer_id: offer.id,
        listing_id: offer.listing_id,
        conversation_id: conversationId,
      },
    });

    return NextResponse.json({ ok: true, conversationId });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message || error?.details || "No se pudo responder a la oferta.",
      },
      { status: 500 }
    );
  }
}
