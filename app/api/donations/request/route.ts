import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotifications } from "@/lib/notifications";
import { getListingTypeFromRow } from "@/lib/marketplace/listing-type";
import { buildDonationChatBody } from "@/lib/donations/chat-message";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    const body = await request.json();
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    if (!listingId) {
      return NextResponse.json({ error: "Falta el anuncio." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: listing, error: listingError } = await adminSupabase
      .from("listings")
      .select("id, title, seller_id, school_id, status, type, listing_type")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError || !listing) {
      return NextResponse.json({ error: "El anuncio no existe." }, { status: 404 });
    }

    if (getListingTypeFromRow(listing as any) !== "donation") {
      return NextResponse.json({ error: "Solo puedes solicitar anuncios de donación." }, { status: 400 });
    }

    if (listing.status !== "available") {
      return NextResponse.json({ error: "La donación ya no está disponible." }, { status: 400 });
    }

    if (!listing.seller_id || user.id === listing.seller_id) {
      return NextResponse.json({ error: "No puedes solicitar tu propia donación." }, { status: 400 });
    }

    const { data: existingRequest } = await adminSupabase
      .from("donation_requests")
      .select("id, status")
      .eq("listing_id", listingId)
      .eq("requester_id", user.id)
      .in("status", ["pending", "approved", "completed"])
      .maybeSingle();

    if (existingRequest) {
      return NextResponse.json({ error: "Ya has solicitado esta donación." }, { status: 400 });
    }

    const { data: insertedRequest, error: insertRequestError } = await adminSupabase
      .from("donation_requests")
      .insert({
        listing_id: listingId,
        requester_id: user.id,
        school_id: listing.school_id || null,
        status: "pending",
        note: note || null,
      })
      .select("id")
      .single();

    if (insertRequestError || !insertedRequest) {
      return NextResponse.json({ error: insertRequestError?.message || "No se pudo crear la solicitud." }, { status: 400 });
    }

    const { data: existingConversation } = await adminSupabase
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .eq("seller_id", listing.seller_id)
      .maybeSingle();

    let conversationId = existingConversation?.id || null;

    if (!conversationId) {
      const { data: newConversation, error: insertConversationError } = await adminSupabase
        .from("conversations")
        .insert({
          listing_id: listingId,
          buyer_id: user.id,
          seller_id: listing.seller_id,
        })
        .select("id")
        .single();

      if (insertConversationError || !newConversation) {
        return NextResponse.json({ error: insertConversationError?.message || "No se pudo abrir el chat." }, { status: 400 });
      }

      conversationId = newConversation.id;
    }

    if (conversationId) {
      await adminSupabase
        .from("hidden_conversations")
        .delete()
        .eq("conversation_id", conversationId)
        .in("user_id", [user.id, listing.seller_id]);
    }

    const now = new Date().toISOString();
    const { data: event } = await adminSupabase
      .from("donation_request_events")
      .insert({
        request_id: insertedRequest.id,
        conversation_id: conversationId,
        actor_id: user.id,
        event_type: "request_created",
        note: note || "Me gustaría solicitar esta donación",
        status_snapshot: "pending",
      })
      .select("id")
      .single();

    if (conversationId) {
      await adminSupabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: buildDonationChatBody({
          eventId: event?.id,
          requestId: insertedRequest.id,
          eventType: "request_created",
          status: "pending",
          note: note || "Me gustaría solicitar esta donación",
        }),
      });

      await adminSupabase.from("conversations").update({ updated_at: now }).eq("id", conversationId);
    }

    await createNotifications(adminSupabase, [
      {
        user_id: listing.seller_id,
        kind: "donation_requested",
        title: "Han solicitado tu donación",
        body: `${user.user_metadata?.full_name || user.email || "Un usuario"} ha solicitado ${listing.title || "tu anuncio"}.`,
        href: conversationId ? `/messages/${conversationId}` : "/messages",
        metadata: {
          listing_id: listingId,
          donation_request_id: insertedRequest?.id || null,
          conversation_id: conversationId,
        },
      },
    ]);

    return NextResponse.json({ ok: true, requestId: insertedRequest?.id || null, conversationId });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo solicitar la donación." },
      { status: 500 }
    );
  }
}
