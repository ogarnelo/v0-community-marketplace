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
  note?: string | null;
}) {
  const { supabase, listingId, actorUserId, note } = params;

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
      school_id: listing.school_id || null,
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

export class DonationDecisionConflictError extends Error {
  constructor() {
    super("La solicitud ya no admite cambios.");
    this.name = "DonationDecisionConflictError";
  }
}
export class DonationDecisionReconciliationError extends Error {
  constructor() {
    super("La decisión se guardó, pero requiere conciliación.");
    this.name = "DonationDecisionReconciliationError";
  }
}

export async function respondToDonationFlow(params: {
  supabase: SupabaseClient;
  requestId: string;
  action: DonationAction;
  actorUserId: string;
}) {
  const { supabase, requestId, action, actorUserId } = params;
  if (action !== "accept" && action !== "reject") throw new Error("Acción inválida.");

  const { data: donationRequest, error: requestError } = await supabase
    .from("donation_requests")
    .select("id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, school_id")
    .eq("id", requestId).maybeSingle();
  if (requestError) throw new Error("No se pudo verificar la solicitud.");
  if (!donationRequest?.listing_id || !donationRequest.requester_id)
    throw new Error("Solicitud no encontrada.");
  if (donationRequest.status !== "pending") throw new DonationDecisionConflictError();

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, title, seller_id, status, school_id")
    .eq("id", donationRequest.listing_id).maybeSingle();
  if (listingError) throw new Error("No se pudo verificar el anuncio.");
  if (!listing || listing.seller_id !== actorUserId)
    throw new Error("No puedes responder a esta solicitud.");
  if ((listing.school_id || null) !== (donationRequest.school_id || null))
    throw new Error("La solicitud y el anuncio son de centros diferentes.");

  if (action === "accept") {
    if (listing.status !== "available") throw new DonationDecisionConflictError();
    // Reject sequential double assignments, even after a failed archive.
    // A race between DIFFERENT request rows still needs a DB constraint.
    const { data: priorWinner, error: winnerError } = await supabase
      .from("donation_requests").select("id")
      .eq("listing_id", donationRequest.listing_id)
      .eq("status", "approved").limit(1).maybeSingle();
    if (winnerError) throw new Error("No se pudo comprobar la asignación previa.");
    if (priorWinner) throw new DonationDecisionConflictError();
  }

  const now = new Date().toISOString();
  const status = action === "accept" ? "approved" : "rejected";
  const { data: updated, error: updateError } = await supabase
    .from("donation_requests")
    .update({
      status, assigned_to_requester_id: action === "accept" ? donationRequest.requester_id : null,
      approved_by_admin_id: actorUserId, updated_at: now,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id").maybeSingle();
  if (updateError) throw new Error("No se pudo guardar la decisión.");
  if (!updated) throw new DonationDecisionConflictError();

  // From this point on the initial decision is committed. A later failure
  // cannot be retried without first reconciling the partially completed flow.
  try {
    if (action === "accept") {
      const { data: archived, error: archiveError } = await supabase
        .from("listings").update({ status: "archived" })
        .eq("id", donationRequest.listing_id)
        .eq("status", "available").select("id").maybeSingle();
      if (archiveError || !archived) throw new Error("archive_not_confirmed");

      const { error: competingError } = await supabase
        .from("donation_requests")
        .update({
          status: "rejected",
          note: "La donación ya fue asignada a otro solicitante.",
          updated_at: now,
        })
        .eq("listing_id", donationRequest.listing_id)
        .neq("id", requestId).eq("status", "pending");
      if (competingError) throw new Error("competitor_update_not_confirmed");
    }
    const conversationId = await getOrCreateConversation({
      supabase, listingId: donationRequest.listing_id,
      buyerId: donationRequest.requester_id, sellerId: listing.seller_id,
    });
    const eventType = action === "accept" ? "approved" : "rejected";
    const message = action === "accept"
      ? "He aceptado tu solicitud de donación. Podemos cerrar por aquí la entrega en mano o el envío."
      : "He rechazado tu solicitud de donación. Puedes seguir buscando otras opciones.";
    const { data: event, error: eventError } = await supabase
      .from("donation_request_events").insert({
        request_id: requestId, conversation_id: conversationId,
        actor_id: actorUserId, event_type: eventType, note: message,
        status_snapshot: status,
      }).select("id").single();
    if (eventError || !event) throw new Error("event_not_confirmed");

    const { error: messageError } = await supabase.from("messages").insert({
      conversation_id: conversationId, sender_id: actorUserId,
      body: buildDonationChatBody({
        eventId: event.id, requestId, eventType, status, note: message,
      }),
    });
    if (messageError) throw new Error("message_not_confirmed");

    await touchConversation(supabase, conversationId, now);
    const { error: notificationError } = await createNotification(supabase, {
      user_id: donationRequest.requester_id,
      kind: action === "accept" ? "donation_approved" : "donation_rejected",
      title: action === "accept"
        ? "Han aceptado tu solicitud de donación" : "Han rechazado tu solicitud de donación",
      body: action === "accept"
        ? `${listing.title || "La donación"} ha sido aceptada.`
        : `${listing.title || "La donación"} ha sido rechazada. Puedes seguir buscando otras opciones.`,
      href: `/messages/${conversationId}`,
      metadata: {
        listing_id: donationRequest.listing_id,
        donation_request_id: requestId,
        conversation_id: conversationId,
      },
    });
    if (notificationError) throw new Error("notification_not_confirmed");
    return { conversationId };
  } catch {
    throw new DonationDecisionReconciliationError();
  }
}
