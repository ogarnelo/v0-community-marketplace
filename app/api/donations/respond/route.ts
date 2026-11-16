import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { respondToDonationFlow, type DonationAction } from "@/lib/services/donations.service";

function isDonationAction(value: unknown): value is DonationAction {
  return value === "accept" || value === "reject";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const noSession = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return privateJson(
        { error: noSession ? "No autenticado." : "No se pudo comprobar tu sesión." },
        { status: noSession ? 401 : 503 }
      );
    }
    const user = authData?.user ?? null;

    if (!user) {
      return privateJson({ error: "No autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
    const action = isDonationAction(body?.action) ? body.action : null;

    if (!requestId || !action) {
      return privateJson({ error: "Petición no válida." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const result = await respondToDonationFlow({
      supabase: adminSupabase,
      requestId,
      action,
      actorUserId: user.id,
    });

    return privateJson({ ok: true, ...result });
  } catch (error: unknown) {
    const name = error && typeof error === "object" && "name" in error ? error.name : null;
    if (name === "DonationDecisionConflictError") {
      return privateJson({ error: "Esta solicitud ya no admite cambios." }, { status: 409 });
    }
    if (name === "DonationDecisionReconciliationError") {
      return privateJson(
        { error: "La decisión se guardó, pero hay operaciones pendientes de conciliación." },
        { status: 503 }
      );
    }
    console.error("donation_response_failed");
    return privateJson({ error: "No se pudo responder a la solicitud." }, { status: 500 });
  }
}
