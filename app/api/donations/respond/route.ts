import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { buildDonationChatBody } from "@/lib/donations/chat-message";

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
    const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
    const action = body?.action === "accept" || body?.action === "reject" ? body.action : null;

    if (!requestId || !action) {
      return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data: donationRequest } = await adminSupabase
      .from("donation_requests")
      .select("id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, created_at, updated_at, school_id")
      .eq("id", requestId)
      .maybeSingle();

    if (!donationRequest || !donationRequest.listing_id || !donationRequest.requester_id) {
      return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
    }

    const { data: listing } = await adminSupabase
      .from("listings")
      .select("id, title, seller_id")
      .eq("id", donationRequest.listing_id)
      .maybeSingle();

    if (!listing || listing.seller_id !== user.id) {
      return NextResponse.json({ error: "No puedes responder a esta solicitud." }, { status: 403 });
    }

    if ((donationRequest.status || "") !== "pending") {
      return NextResponse.json({ error: "Esta solicitud ya no admite cambios." }, { status: 400 });
    }

    const { data: existingConversation } = await adminSupabase
      .from("conversations")
      .select("id")
      .eq("listing_id", donationRequest.listing_id)
      .eq("buyer_id", donationRequest.requester_id)
      .eq("seller_id", listing.seller_id)
      .maybeSingle();

    const conversationId = existingConversation?.id || null;
    const now = new Date().toISOString();

    if (action === "accept") {
      await adminSupabase
        .from("donation_requests")
        .update({
          status: "approved",
          assigned_to_requester_id: donationRequest.requester_id,
          approved_by_admin_id: user.id,
          updated_at: now,
        })
        .eq("id", requestId);

      await adminSupabase.from("listings").update({ status: "archived" }).eq("id", donationRequest.listing_id);

      const { data: event } = await adminSupabase
        .from("donation_request_events")
        .insert({
          request_id: requestId,
          conversation_id: conversationId,
          actor_id: user.id,
          event_type: "approved",
          note: "He aceptado tu solicitud de donación. Podemos cerrar por aquí la entrega en mano o el envío.",
          status_snapshot: "approved",
        })
        .select("id")
        .single();

      if (conversationId) {
        await adminSupabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body: buildDonationChatBody({
            eventId: event?.id,
            requestId,
            eventType: "approved",
            status: "approved",
            note: "He aceptado tu solicitud de donación. Podemos cerrar por aquí la entrega en mano o el envío.",
          }),
        });
        await adminSupabase.from("conversations").update({ updated_at: now }).eq("id", conversationId);
      }

      await createNotification(adminSupabase, {
        user_id: donationRequest.requester_id,
        kind: "donation_approved",
        title: "Han aceptado tu solicitud de donación",
        body: `${listing.title || "La donación"} ha sido aceptada.`,
        href: conversationId ? `/messages/${conversationId}` : "/account/activity",
        metadata: { listing_id: donationRequest.listing_id, donation_request_id: requestId, conversation_id: conversationId },
      });

      return NextResponse.json({ ok: true, conversationId });
    }

    await adminSupabase
      .from("donation_requests")
      .update({ status: "rejected", approved_by_admin_id: user.id, updated_at: now })
      .eq("id", requestId);

    const { data: event } = await adminSupabase
      .from("donation_request_events")
      .insert({
        request_id: requestId,
        conversation_id: conversationId,
        actor_id: user.id,
        event_type: "rejected",
        note: "He rechazado tu solicitud de donación. Puedes seguir buscando otras opciones.",
        status_snapshot: "rejected",
      })
      .select("id")
      .single();

    if (conversationId) {
      await adminSupabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: buildDonationChatBody({
          eventId: event?.id,
          requestId,
          eventType: "rejected",
          status: "rejected",
          note: "He rechazado tu solicitud de donación. Puedes seguir buscando otras opciones.",
        }),
      });
      await adminSupabase.from("conversations").update({ updated_at: now }).eq("id", conversationId);
    }

    await createNotification(adminSupabase, {
      user_id: donationRequest.requester_id,
      kind: "donation_rejected",
      title: "Han rechazado tu solicitud de donación",
      body: `${listing.title || "La donación"} ha sido rechazada. Puedes seguir buscando otras opciones.`,
      href: conversationId ? `/messages/${conversationId}` : "/account/activity",
      metadata: { listing_id: donationRequest.listing_id, donation_request_id: requestId, conversation_id: conversationId },
    });

    return NextResponse.json({ ok: true, conversationId });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo responder a la solicitud." },
      { status: 500 }
    );
  }
}
