import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getListingTypeFromRow } from "@/lib/marketplace/listing-type";
import { buildDonationChatBody } from "@/lib/donations/chat-message";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

    const body = await request.json();
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    if (!listingId) return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });

    const admin = createAdminClient();
    const { data: listing, error } = await admin.from("listings").select("id, title, seller_id, status, type, listing_type").eq("id", listingId).maybeSingle();
    if (error || !listing) return NextResponse.json({ error: "El anuncio no existe." }, { status: 404 });
    if (getListingTypeFromRow(listing as any) !== "donation") return NextResponse.json({ error: "Este anuncio no es una donación." }, { status: 400 });
    if (listing.status !== "available") return NextResponse.json({ error: "Esta donación ya no acepta nuevas solicitudes." }, { status: 400 });
    if (!listing.seller_id || listing.seller_id === user.id) return NextResponse.json({ error: "No puedes solicitar tu propia donación." }, { status: 400 });

    const { data: activeRequest } = await admin.from("donation_requests").select("id").eq("listing_id", listingId).eq("requester_id", user.id).in("status", ["pending"]).maybeSingle();
    if (activeRequest) return NextResponse.json({ error: "Ya tienes una solicitud pendiente para esta donación." }, { status: 400 });

    const now = new Date().toISOString();
    const { data: donationRequest, error: requestError } = await admin.from("donation_requests").insert({
      listing_id: listingId,
      requester_id: user.id,
      status: "pending",
      note: note || null,
      school_id: null,
      updated_at: now,
    }).select("id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, created_at, updated_at, school_id").single();
    if (requestError || !donationRequest) return NextResponse.json({ error: requestError?.message || "No se pudo registrar la solicitud." }, { status: 400 });

    const { data: existingConversation } = await admin.from("conversations").select("id").eq("listing_id", listingId).eq("buyer_id", user.id).eq("seller_id", listing.seller_id).maybeSingle();
    let conversationId = existingConversation?.id || null;
    if (!conversationId) {
      const { data: newConversation, error: conversationError } = await admin.from("conversations").insert({ listing_id: listingId, buyer_id: user.id, seller_id: listing.seller_id }).select("id").single();
      if (conversationError || !newConversation) return NextResponse.json({ error: conversationError?.message || "No se pudo abrir el chat." }, { status: 400 });
      conversationId = newConversation.id;
    } else {
      await admin.from("hidden_conversations").delete().eq("conversation_id", conversationId).in("user_id", [user.id, listing.seller_id]);
    }

    const { data: event, error: eventError } = await admin.from("donation_request_events").insert({
      request_id: donationRequest.id,
      conversation_id: conversationId,
      actor_id: user.id,
      event_type: "request_created",
      note: note || null,
      status_snapshot: "pending",
    }).select("id").single();
    if (eventError || !event) return NextResponse.json({ error: eventError?.message || "No se pudo guardar el historial de la solicitud." }, { status: 400 });

    await admin.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: buildDonationChatBody({
        eventId: event.id,
        requestId: donationRequest.id,
        eventType: "request_created",
        status: "pending",
        note: note || "Me gustaría solicitar esta donación",
      }),
    });
    await admin.from("conversations").update({ updated_at: now }).eq("id", conversationId);

    await createNotification(admin, {
      user_id: listing.seller_id,
      kind: "donation_requested",
      title: "Has recibido una solicitud de donación",
      body: listing.title || "Revisa la conversación para responder.",
      href: `/messages/${conversationId}`,
      metadata: { listing_id: listingId, donation_request_id: donationRequest.id, conversation_id: conversationId },
    });

    return NextResponse.json({ ok: true, requestId: donationRequest.id, conversationId });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || error?.details || "No se pudo solicitar la donación." }, { status: 500 });
  }
}
