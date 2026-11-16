import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOfferFlow } from "@/lib/services/offers.service";
import { isLegacyCommerceEnabled } from "@/lib/launch/feature-gates";

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
      return privateJson({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    const body = await request.json();
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const offeredPrice = Number(body?.offeredPrice);

    if (!listingId || !Number.isFinite(offeredPrice) || offeredPrice <= 0) {
      return privateJson({ error: "La oferta no es válida." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const result = await createOfferFlow({
      supabase: adminSupabase,
      listingId,
      offeredPrice,
      actorUserId: user.id,
    });

    if (result.alreadyExists) {
      return privateJson(
        {
          ok: false,
          redirectTo: `/messages/${result.conversationId}`,
          conversationId: result.conversationId,
          offerId: result.offerId,
          error: "Ya tienes una negociación abierta para este anuncio. Te llevamos al chat para continuarla.",
        },
        { status: 409 }
      );
    }

    return privateJson({ ok: true, ...result });
  } catch {
    console.error("offer_creation_failed");
    return privateJson({ error: "No se pudo crear la oferta." }, { status: 500 });
  }
}
