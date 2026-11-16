import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotifications } from "@/lib/notifications";
import { getAdminFlags } from "@/lib/admin/roles";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const absent = authError.name === "AuthSessionMissingError" || authError.code === "session_not_found";
      return privateJson(
        { error: absent ? "No autenticado." : "No se pudo comprobar tu sesión." },
        { status: absent ? 401 : 503 }
      );
    }
    const user = authData?.user ?? null;

    if (!user) {
      return privateJson({ error: "No autenticado." }, { status: 401 });
    }

    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id);

    if (roleError) return privateJson({ error: "No se pudo comprobar tu permiso." }, { status: 503 });

    const adminFlags = getAdminFlags({
      email: user.email,
      roles: (roles || []) as Array<{ role: string; school_id: string | null }>,
    });

    if (!adminFlags.canAccessAdmin) {
      return privateJson({ error: "Sin permisos." }, { status: 403 });
    }

    const body = await request.json();
    const donationRequestId =
      typeof body?.donationRequestId === "string" ? body.donationRequestId.trim() : "";
    const action = body?.action === "approve" || body?.action === "reject" ? body.action : null;
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 600) : "";

    if (!donationRequestId || !action) {
      return privateJson({ error: "Falta la solicitud." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: donationRequest, error: requestError } = await adminSupabase
      .from("donation_requests")
      .select("id, listing_id, requester_id, school_id, status")
      .eq("id", donationRequestId)
      .maybeSingle();

    if (requestError) return privateJson({ error: "No se pudo consultar la solicitud." }, { status: 503 });
    if (!donationRequest || !donationRequest.listing_id) {
      return privateJson({ error: "Solicitud no encontrada." }, { status: 404 });
    }

    if (donationRequest.status !== "pending") {
      return privateJson({ error: "Esta solicitud ya se ha revisado o ha cambiado de estado." }, { status: 409 });
    }

    const allowedSchoolId = adminFlags.isSuperAdmin
      ? donationRequest.school_id
      : adminFlags.schoolAdminSchoolId;

    if (!adminFlags.isSuperAdmin && donationRequest.school_id !== allowedSchoolId) {
      return privateJson({ error: "No puedes revisar solicitudes de otro centro." }, { status: 403 });
    }

    const { data: listing, error: listingError } = await adminSupabase
      .from("listings")
      .select("id, title, seller_id, school_id")
      .eq("id", donationRequest.listing_id)
      .maybeSingle();

    if (listingError) return privateJson({ error: "No se pudo comprobar el anuncio." }, { status: 503 });
    if (!listing) return privateJson({ error: "Anuncio no encontrado." }, { status: 404 });
    if (!donationRequest.school_id || listing.school_id !== donationRequest.school_id) {
      return privateJson({ error: "La solicitud y el anuncio no pertenecen al mismo centro." }, { status: 409 });
    }

    const { data: existingConversation, error: conversationError } = await adminSupabase
      .from("conversations")
      .select("id")
      .eq("listing_id", donationRequest.listing_id)
      .eq("buyer_id", donationRequest.requester_id)
      .eq("seller_id", listing?.seller_id || "")
      .maybeSingle();

    if (conversationError) return privateJson({ error: "No se pudo verificar la conversación." }, { status: 503 });
    const conversationId = existingConversation?.id || null;

    if (action === "approve") {
      if (!donationRequest.requester_id) {
        return privateJson({ error: "La solicitud no tiene destinatario válido." }, { status: 409 });
      }
      const now = new Date().toISOString();

      const { data: approved, error: approveError } = await adminSupabase
        .from("donation_requests")
        .update({
          status: "approved",
          assigned_to_requester_id: donationRequest.requester_id,
          approved_by_admin_id: user.id,
          note: note || null,
          updated_at: now,
        })
        .eq("id", donationRequestId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (approveError) return privateJson({ error: "No se pudo aprobar la solicitud." }, { status: 503 });
      if (!approved) return privateJson({ error: "La solicitud ha cambiado de estado. Actualiza la pantalla." }, { status: 409 });

      const { error: competitorsError } = await adminSupabase
        .from("donation_requests")
        .update({
          status: "rejected",
          note: "La donación ya fue asignada a otro solicitante.",
          updated_at: now,
        })
        .eq("listing_id", donationRequest.listing_id)
        .neq("id", donationRequestId)
        .eq("status", "pending");
      if (competitorsError) {
        console.error("donation_review_competitor_rejection_failed");
        return privateJson(
          { error: "La asignación se guardó, pero requiere conciliar las solicitudes competidoras." },
          { status: 503 }
        );
      }

      const { error: archiveError } = await adminSupabase
        .from("listings")
        .update({ status: "archived" })
        .eq("id", donationRequest.listing_id);
      if (archiveError) {
        console.error("donation_review_listing_archive_failed");
        return privateJson(
          { error: "La asignación se guardó, pero requiere conciliar el anuncio." },
          { status: 503 }
        );
      }

      if (conversationId) {
        const { error: messageError } = await adminSupabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: listing?.seller_id || user.id,
          body: note
            ? `🎁 Donación aprobada por el centro. Nota: ${note}`
            : "🎁 Donación aprobada por el centro.",
        });

        if (messageError) {
          console.error("donation_review_message_write_failed");
          return privateJson(
            { error: "La decisión se guardó, pero requiere conciliar el mensaje." },
            { status: 503 }
          );
        }

        const { error: conversationUpdateError } = await adminSupabase
          .from("conversations")
          .update({ updated_at: now })
          .eq("id", conversationId);
        if (conversationUpdateError) {
          console.error("donation_review_conversation_write_failed");
          return privateJson(
            { error: "La decisión se guardó, pero requiere conciliar la conversación." },
            { status: 503 }
          );
        }
      }

      const { error: notifyError } = await createNotifications(adminSupabase, [
        donationRequest.requester_id
          ? {
            user_id: donationRequest.requester_id,
            kind: "donation_approved",
            title: "Han aprobado tu solicitud de donación",
            body: `${listing?.title || "La donación"} ha sido asignada a tu usuario.`,
            href: conversationId ? `/messages/${conversationId}` : "/messages",
            metadata: {
              donation_request_id: donationRequestId,
              listing_id: donationRequest.listing_id,
            },
          }
          : null,
        listing?.seller_id
          ? {
            user_id: listing.seller_id,
            kind: "donation_reviewed",
            title: "La donación ya tiene destinatario",
            body: `El centro ha aprobado la solicitud para ${listing.title || "tu anuncio"}.`,
            href: conversationId ? `/messages/${conversationId}` : "/messages",
            metadata: {
              donation_request_id: donationRequestId,
              listing_id: donationRequest.listing_id,
            },
          }
          : null,
      ].filter(Boolean) as Array<{
        user_id: string;
        kind: string;
        title: string;
        body: string;
        href: string;
        metadata: Record<string, unknown>;
      }>);
      if (notifyError) {
        console.error("donation_review_notification_write_failed");
        return privateJson({ error: "La decisión se guardó, pero requiere conciliar las notificaciones." }, { status: 503 });
      }
    } else {
      const now = new Date().toISOString();

      const { data: rejected, error: rejectError } = await adminSupabase
        .from("donation_requests")
        .update({
          status: "rejected",
          approved_by_admin_id: user.id,
          note: note || null,
          updated_at: now,
        })
        .eq("id", donationRequestId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (rejectError) return privateJson({ error: "No se pudo rechazar la solicitud." }, { status: 503 });
      if (!rejected) return privateJson({ error: "La solicitud ha cambiado de estado. Actualiza la pantalla." }, { status: 409 });

      if (conversationId) {
        const { error: messageError } = await adminSupabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: listing?.seller_id || user.id,
          body: note
            ? `❌ Solicitud de donación rechazada. Nota del centro: ${note}`
            : "❌ Solicitud de donación rechazada por el centro.",
        });

        if (messageError) {
          console.error("donation_review_message_write_failed");
          return privateJson(
            { error: "La decisión se guardó, pero requiere conciliar el mensaje." },
            { status: 503 }
          );
        }

        const { error: conversationUpdateError } = await adminSupabase
          .from("conversations")
          .update({ updated_at: now })
          .eq("id", conversationId);
        if (conversationUpdateError) {
          console.error("donation_review_conversation_write_failed");
          return privateJson(
            { error: "La decisión se guardó, pero requiere conciliar la conversación." },
            { status: 503 }
          );
        }
      }

      if (donationRequest.requester_id) {
        const { error: notifyError } = await createNotifications(adminSupabase, [
          {
            user_id: donationRequest.requester_id,
            kind: "donation_rejected",
            title: "Han rechazado tu solicitud de donación",
            body: note || `La solicitud para ${listing?.title || "la donación"} ha sido rechazada.`,
            href: conversationId ? `/messages/${conversationId}` : "/messages",
            metadata: {
              donation_request_id: donationRequestId,
              listing_id: donationRequest.listing_id,
            },
          },
        ]);
        if (notifyError) {
          console.error("donation_review_notification_write_failed");
          return privateJson({ error: "La decisión se guardó, pero requiere conciliar las notificaciones." }, { status: 503 });
        }
      }
    }

    return privateJson({ ok: true });
  } catch {
    console.error("donation_review_unexpected_failure");
    return privateJson({ error: "No se pudo revisar la solicitud." }, { status: 500 });
  }
}
