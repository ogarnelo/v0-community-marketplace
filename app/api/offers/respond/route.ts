import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { respondToOfferFlow, type OfferAction } from "@/lib/services/offers.service";
import { isLegacyCommerceEnabled } from "@/lib/launch/feature-gates";

function isOfferAction(value: unknown): value is OfferAction {
  return value === "accept" || value === "reject" || value === "counter";
}

export async function POST(request: Request) {
  if (!isLegacyCommerceEnabled()) {
    return privateJson(
      { error: "Esta función no está activa durante el lanzamiento inicial de Wetudy." },
      { status: 404 }
    );
  }

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
    const offerId = typeof body?.offerId === "string" ? body.offerId.trim() : "";
    const action = isOfferAction(body?.action) ? body.action : null;
    const counterPrice = body?.counterPrice == null ? null : Number(body.counterPrice);

    if (!offerId || !action) {
      return privateJson({ error: "Petición no válida." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const result = await respondToOfferFlow({
      supabase: adminSupabase,
      offerId,
      action,
      actorUserId: user.id,
      counterPrice,
    });

    return privateJson({ ok: true, ...result });
  } catch (error: unknown) {
    // Preserve an explicit set of user-facing business errors without exposing
    // arbitrary Postgres, provider or stack diagnostics to the client.
    const message = error instanceof Error ? error.message : "";
    const safeMessage =
      message.includes("no admite cambios") ? "La oferta ya no admite cambios." :
      message.includes("No puedes") ? "No puedes responder a esta oferta." :
      message.includes("máximo") ? "Se ha alcanzado el máximo permitido." :
      message.includes("no es válida") ? "La respuesta no es válida." : null;
    if (safeMessage) return privateJson({ error: safeMessage }, { status: 400 });
    console.error("offer_response_failed");
    return privateJson({ error: "No se pudo responder a la oferta." }, { status: 500 });
  }
}
