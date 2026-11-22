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
import { resolveUniqueSchoolAdminSchoolId } from "@/lib/marketplace/unique-school-admin-context";

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

    if (roleError || !Array.isArray(roles)) {
      return privateJson({ error: "No se pudo comprobar tu permiso." }, { status: 503 });
    }
    const adminFlags = getAdminFlags({
      email: user.email,
      roles: roles as Array<{ role: string; school_id: string | null }>,
    });
    if (!adminFlags.canAccessAdmin) {
      return privateJson({ error: "Sin permisos." }, { status: 403 });
    }

    // A school manager with two active/duplicated grants may not choose an
    // arbitrary first school. Super-admin authority is explicit and separate.
    let verifiedSchoolAdminSchoolId: string | null = null;
    if (!adminFlags.isSuperAdmin) {
      try {
        verifiedSchoolAdminSchoolId = resolveUniqueSchoolAdminSchoolId(
          roles.filter((role) => role.role === "school_admin").map((role) => ({
            school_id: role.school_id,
          }))
        );
      } catch {
        return privateJson({ error: "Permisos de centro ambiguos." }, { status: 403 });
      }
      if (!verifiedSchoolAdminSchoolId) {
        return privateJson({ error: "Sin permisos de centro válidos." }, { status: 403 });
      }
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
      : verifiedSchoolAdminSchoolId;

    if (
      !donationRequest.school_id || !allowedSchoolId ||
      donationRequest.school_id.toLowerCase() !== allowedSchoolId.toLowerCase()
    ) {
      return privateJson({ error: "No puedes revisar solicitudes de otro centro." }, { status: 403 });
    }

    // Deny decisions for a deactivated or missing school, before any write.
    const { data: school, error: schoolError } = await adminSupabase
      .from("schools")
      .select("id, is_active")
      .eq("id", donationRequest.school_id)
      .maybeSingle();
    if (schoolError) {
      return privateJson({ error: "No se pudo verificar el centro." }, { status: 503 });
    }
    if (!school || school.is_active !== true) {
      return privateJson({ error: "El centro ya no está activo." }, { status: 403 });
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

    // OFF by default. Installing the review-only candidate RPC AND enabling
    // this switch are separate, owner-authorized production operations.
    // The RPC coordinates winner, losing pending rows and listing archive in
    // ONE DB transaction; notifications remain explicit postcommit effects.
    const atomicReviewEnabled =
      typeof process !== "undefined" &&
      process.env.WETUDY_R3_DONATION_ATOMIC_REVIEW_ENABLED === "true";
    if (atomicReviewEnabled) {
      const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
        "r3_review_donation_atomic",
        {
          p_actor_id: user.id,
          p_request_id: donationRequestId,
          p_action: action,
          p_note: note || null,
        }
      );
      if (rpcError) {
        const denied = rpcError.code === "42501";
        const conflict =
          rpcError.code === "23505" || rpcError.message?.includes("R3_DONATION_STATUS_CONFLICT") ||
          rpcError.message?.includes("R3_DONATION_ARCHIVE_CONFLICT") ||
          rpcError.message?.includes("R3_DONATION_CONTEXT_CONFLICT");
        return privateJson(
          { error: denied ? "Sin permisos para esta revisión." : conflict
            ? "La solicitud ya ha cambiado. Actualiza la pantalla."
            : "No se pudo confirmar la decisión. Comprueba su estado antes de volver a intentarlo." },
          { status: denied ? 403 : conflict ? 409 : 503 }
        );
      }
      const row = Array.isArray(rpcData)
        ? (rpcData.length === 1 ? rpcData[0] : null)
        : rpcData;
      if (
        !row ||
        typeof row.request_id !== "string" ||
        row.request_id.toLowerCase() !== donationRequestId.toLowerCase() ||
        row.decision_status !== (action === "approve" ? "approved" : "rejected") ||
        row.listing_id !== donationRequest.listing_id ||
        row.requester_id !== donationRequest.requester_id ||
        row.school_id !== donationRequest.school_id
      ) {
        console.error("r3_donation_review_rpc_result_unverified");
        return privateJson(
          { error: "No se pudo verificar la decisión. Comprueba su estado antes de reintentar." },
          { status: 503 }
        );
      }
    }

    if (action === "approve") {
      if (!donationRequest.requester_id) {
        return privateJson({ error: "La solicitud no tiene destinatario válido." }, { status: 409 });
      }
      const now = new Date().toISOString();

      if (!atomicReviewEnabled) {
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

      if (!atomicReviewEnabled) {
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
  
        }

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
