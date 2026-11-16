import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}


import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotificationOnce } from "@/lib/notifications";

function normalizeRpcRow<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const missingSession = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return privateJson(
        { error: missingSession ? "Debes iniciar sesión." : "No se pudo comprobar tu sesión." },
        { status: missingSession ? 401 : 503 }
      );
    }
    const user = authData?.user ?? null;

    if (!user) {
      return privateJson({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const agreementId =
      typeof body?.agreementId === "string" ? body.agreementId.trim() : "";
    const note =
      typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;

    if (!agreementId) {
      return privateJson({ error: "Falta el acuerdo." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("server_cancel_agreement", {
      p_actor_id: user.id,
      p_agreement_id: agreementId,
      p_note: note,
    });

    if (error) {
      const message = error.message || "No se pudo cancelar.";
      const lower = message.toLowerCase();

      if (lower.includes("agreement not found")) {
        return privateJson({ error: "No se encontró el acuerdo." }, { status: 404 });
      }
      if (lower.includes("not allowed")) {
        return privateJson({ error: "No puedes cancelar este acuerdo." }, { status: 403 });
      }
      if (lower.includes("confirmed agreements")) {
        return privateJson(
          { error: "Un acuerdo confirmado no se cancela. Puedes reportar una incidencia." },
          { status: 409 }
        );
      }
      if (lower.includes("disputed agreements")) {
        return privateJson(
          { error: "Un acuerdo con una incidencia abierta no se puede cancelar." },
          { status: 409 }
        );
      }

      throw error;
    }

    const agreement = normalizeRpcRow<any>(data);

    if (agreement) {
      const recipientId =
        user.id === agreement.buyer_id ? agreement.seller_id : agreement.buyer_id;
      const actorHadProposed =
        user.id === agreement.buyer_id
          ? Boolean(agreement.buyer_confirmed_at)
          : Boolean(agreement.seller_confirmed_at);

      try {
        await createNotificationOnce(admin, {
          event_key: `agreement-cancelled/${agreement.id}`,
          user_id: recipientId,
          kind: "agreement_cancelled",
          title: actorHadProposed ? "Propuesta retirada" : "Propuesta rechazada",
          body: actorHadProposed
            ? `${user.user_metadata?.full_name || "La otra persona"} ha retirado su propuesta.`
            : `${user.user_metadata?.full_name || "La otra persona"} ha rechazado la propuesta.`,
          href: `/messages/${agreement.conversation_id}#agreement-panel`,
          metadata: {
            agreement_id: agreement.id,
            conversation_id: agreement.conversation_id,
            listing_id: agreement.listing_id,
          },
        });
      } catch (notificationError) {
        console.error("No se pudo crear la notificación de cancelación", notificationError);
      }
    }

    return privateJson({ ok: true, agreement });
  } catch {
    console.error("agreement_cancel_failed");
    return privateJson({ error: "No se pudo cancelar el acuerdo." }, { status: 500 });
  }
}
