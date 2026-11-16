import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}


import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

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
    const amount = Number(body?.amount);
    const note =
      typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;

    if (!agreementId || !Number.isFinite(amount) || amount <= 0) {
      return privateJson({ error: "La nueva propuesta no es válida." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("server_counter_agreement", {
      p_actor_id: user.id,
      p_agreement_id: agreementId,
      p_amount: amount,
      p_note: note,
    });

    if (error) {
      const message = error.message || "No se pudo enviar la nueva propuesta.";
      const lower = message.toLowerCase();
      if (lower.includes("agreement not found")) {
        return privateJson({ error: "No se encontró el acuerdo." }, { status: 404 });
      }
      if (lower.includes("not allowed")) {
        return privateJson({ error: "No puedes modificar este acuerdo." }, { status: 403 });
      }
      if (lower.includes("current state")) {
        return privateJson({ error: "Este acuerdo ya no admite nuevas propuestas." }, { status: 409 });
      }
      throw error;
    }

    const agreement = normalizeRpcRow<any>(data);
    if (!agreement) {
      return privateJson({ error: "No se pudo actualizar el acuerdo." }, { status: 500 });
    }

    const recipientId =
      user.id === agreement.buyer_id ? agreement.seller_id : agreement.buyer_id;

    try {
      await createNotification(admin, {
        user_id: recipientId,
        kind: "agreement_countered",
        title: "Nueva oferta",
        body: `${user.user_metadata?.full_name || "La otra persona"} te propone ${Number(agreement.amount).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}.`,
        href: `/messages/${agreement.conversation_id}#agreement-panel`,
        metadata: {
          agreement_id: agreement.id,
          conversation_id: agreement.conversation_id,
          listing_id: agreement.listing_id,
        },
      });
    } catch (notificationError) {
      console.error("No se pudo crear la notificación de contraoferta", notificationError);
    }

    return privateJson({ ok: true, agreement });
  } catch {
    console.error("agreement_counter_failed");
    return privateJson({ error: "No se pudo enviar la nueva propuesta." }, { status: 500 });
  }
}
