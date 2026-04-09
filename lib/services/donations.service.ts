import type { SupabaseClient } from "@supabase/supabase-js";
import { canRequestDonation } from "@/lib/marketplace/rules";
import { createNotification } from "@/lib/notifications";
import { buildDonationChatBody } from "@/lib/donations/chat-message";
import { getOrCreateConversation, touchConversation } from "@/lib/services/conversations.service";

export type DonationAction = "accept" | "reject";

export async function requestDonationFlow(params: {
  supabase: SupabaseClient;
  listingId: string;
  actorUserId: string;
  schoolId?: string | null;
  note?: string | null;
}) {
  const { supabase, listingId, actorUserId, schoolId, note } = params;

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, title, seller_id, school_id, status, type, listing_type")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError || !listing) {
    throw new Error("El anuncio no existe.");
  }

  const donationCheck = canRequestDonation({ listing, currentUserId: actorUserId });
  if (!donationCheck.ok) {
    throw new Error(donationCheck.error);
  }

  const { data: existingRequest, error: existingRequestError } = await supabase
    .from("donation_requests")
    .select("id")
    .eq("listing_id", listingId)
    .eq("requester_id", actorUserId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingRequestError) {
    throw new Error(existingRequestError.message || "No se pudo comprobar la solicitud existente.");
  }

  if (existingRequest) {
    throw new Error("Ya has solicitado esta donación.");
  }

  const conversationId = await getOrCreateConversation({
    supabase,
    listingId,
    buyerId: actorUserId,
    sellerId: listing.seller_id,
  });

  const now = new Date().toISOString();

  const { data: donationRequest, error: donationRequestError } = await supabase
    .from("donation_requests")
    .insert({
      listing_id: listingId,
      requester_id: actorUserId,
      status: "pending",
      note: note || null,
      school_id: schoolId || listing.school_id || null,
      assigned_to_requester_id: null,
      approved_by_admin_id: null,
      updated_at: now,
    })
    .select("id, listing_id, requester_id, school_id, status, note")
    .single();

  if (donationRequestError || !donationRequest) {
    throw new Error(donationRequestError?.message || "No se pudo crear la solicitud.");
  }

  const { data: event, error: eventError } = await supabase
    .from("donation_request_events")
    .insert({
      request_id: donationRequest.id,
      conversation_id: conversationId,
      actor_id: actorUserId,
      event_type: "request_created",
      note: note || null,
      status_snapshot: "pending",
    })
    .select("id")
    .single();

  if (eventError || !event) {
    throw new Error(eventError?.message || "No se pudo registrar el historial de la solicitud.");
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: actorUserId,
    body: buildDonationChatBody({
      eventId: event.id,
      requestId: donationRequest.id,
      eventType: "request_created",
      status: "pending",
      note: note || null,
    }),
  });

  await touchConversation(supabase, conversationId, now);

  await createNotification(supabase, {
    user_id: listing.seller_id,
    kind: "donation_requested",
    title: "Han solicitado tu donación",
    body: listing.title || "Tienes una nueva solicitud de donación.",
    href: `/messages/${conversationId}`,
    metadata: { listing_id: listingId, donation_request_id: donationRequest.id, conversation_id: conversationId },
  });

  return { requestId: donationRequest.id, conversationId };
}

export async function respondToDonationFlow(params: {
  supabase: SupabaseClient;
  requestId: string;
  action: DonationAction;
  actorUserId: string;
}) {
  const { supabase, requestId, action, actorUserId } = params;

  const { data: donationRequest, error: donationRequestError } = await supabase
    .from("donation_requests")
    .select("id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, school_id")
    .eq("id", requestId)
    .maybeSingle();

  if (donationRequestError || !donationRequest || !donationRequest.listing_id || !donationRequest.requester_id) {
    throw new Error("Solicitud no encontrada.");
  }

  if ((donationRequest.status || "") !== "pending") {
    throw new Error("Esta solicitud ya no admite cambios.");
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, title, seller_id, status")
    .eq("id", donationRequest.listing_id)
    .maybeSingle();

  if (listingError || !listing || listing.seller_id !== actorUserId) {
    throw new Error("No puedes responder a esta solicitud.");
  }

  const conversationId = await getOrCreateConversation({
    supabase,
    listingId: donationRequest.listing_id,
    buyerId: donationRequest.requester_id,
    sellerId: listing.seller_id,
  });

  const now = new Date().toISOString();

  if (action === "accept") {
    const { error: updateRequestError } = await supabase
      .from("donation_requests")
      .update({
        status: "approved",
        assigned_to_requester_id: donationRequest.requester_id,
        approved_by_admin_id: actorUserId,
        updated_at: now,
      })
      .eq("id", requestId);

    if (updateRequestError) {
      throw new Error(updateRequestError.message || "No se pudo aprobar la solicitud.");
    }

    await supabase.from("listings").update({ status: "archived" }).eq("id", donationRequest.listing_id);

    const { data: event, error: eventError } = await supabase
      .from("donation_request_events")
      .insert({
        request_id: requestId,
        conversation_id: conversationId,
        actor_id: actorUserId,
        event_type: "approved",
        note: "He aceptado tu solicitud de donación. Podemos cerrar por aquí la entrega en mano o el envío.",
        status_snapshot: "approved",
      })
      .select("id")
      .single();

    if (eventError || !event) {
      throw new Error(eventError?.message || "No se pudo registrar la aprobación.");
    }

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: actorUserId,
      body: buildDonationChatBody({
        eventId: event.id,
        requestId,
        eventType: "approved",
        status: "approved",
        note: "He aceptado tu solicitud de donación. Podemos cerrar por aquí la entrega en mano o el envío.",
      }),
    });

    await touchConversation(supabase, conversationId, now);

    await createNotification(supabase, {
      user_id: donationRequest.requester_id,
      kind: "donation_approved",
      title: "Han aceptado tu solicitud de donación",
      body: `${listing.title || "La donación"} ha sido aceptada.`,
      href: `/messages/${conversationId}`,
      metadata: { listing_id: donationRequest.listing_id, donation_request_id: requestId, conversation_id: conversationId },
    });

    return { conversationId };
  }

  const { error: rejectRequestError } = await supabase
    .from("donation_requests")
    .update({
      status: "rejected",
      approved_by_admin_id: actorUserId,
      updated_at: now,
    })
    .eq("id", requestId);

  if (rejectRequestError) {
    throw new Error(rejectRequestError.message || "No se pudo rechazar la solicitud.");
  }

  const { data: event, error: eventError } = await supabase
    .from("donation_request_events")
    .insert({
      request_id: requestId,
      conversation_id: conversationId,
      actor_id: actorUserId,
      event_type: "rejected",
      note: "He rechazado tu solicitud de donación. Puedes seguir buscando otras opciones.",
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
    body: buildDonationChatBody({
      eventId: event.id,
      requestId,
      eventType: "rejected",
      status: "rejected",
      note: "He rechazado tu solicitud de donación. Puedes seguir buscando otras opciones.",
    }),
  });

  await touchConversation(supabase, conversationId, now);

  await createNotification(supabase, {
    user_id: donationRequest.requester_id,
    kind: "donation_rejected",
    title: "Han rechazado tu solicitud de donación",
    body: `${listing.title || "La donación"} ha sido rechazada. Puedes seguir buscando otras opciones.`,
    href: `/messages/${conversationId}`,
    metadata: { listing_id: donationRequest.listing_id, donation_request_id: requestId, conversation_id: conversationId },
  });

  return { conversationId };
}
