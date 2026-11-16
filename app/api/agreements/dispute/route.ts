import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}


import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoListing } from "@/lib/seo/demo-listing";

const INCIDENT_REASON_LABELS: Record<string, string> = {
  delivery_missing: "No se ha realizado la entrega",
  item_not_as_agreed: "El artículo no coincide con lo acordado",
  payment_problem: "Problema con el pago acordado",
  inappropriate_behavior: "Trato inapropiado",
  other: "Otro problema",
};

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
    const reason =
      typeof body?.reason === "string" ? body.reason.trim() : "";
    const details =
      typeof body?.details === "string" ? body.details.trim().slice(0, 1000) : "";

    if (!agreementId) {
      return privateJson({ error: "Falta el acuerdo." }, { status: 400 });
    }

    const reasonLabel = INCIDENT_REASON_LABELS[reason];
    if (!reasonLabel) {
      return privateJson({ error: "Selecciona un motivo para la incidencia." }, { status: 400 });
    }

    if (details.length < 10) {
      return privateJson(
        { error: "Explica brevemente qué ha ocurrido para que podamos revisarlo." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    // A DEMO cannot create an authentic moderation case, mutate a confirmed
    // agreement to disputed, or send automated incident messages.
    const { data: currentAgreement, error: agreementLookupError } = await admin
      .from("agreements")
      .select("listing_id,buyer_id,seller_id")
      .eq("id", agreementId)
      .maybeSingle();
    if (agreementLookupError) {
      throw agreementLookupError;
    }
    if (!currentAgreement) {
      return privateJson({ error: "No se encontró el acuerdo." }, { status: 404 });
    }
    if (currentAgreement.buyer_id !== user.id && currentAgreement.seller_id !== user.id) {
      return privateJson({ error: "No puedes reportar este acuerdo." }, { status: 403 });
    }

    const { data: reportListing, error: listingLookupError } = await admin
      .from("listings")
      .select("id,title")
      .eq("id", currentAgreement.listing_id)
      .maybeSingle();
    if (listingLookupError || !reportListing) {
      return privateJson(
        { error: "No se pudo verificar el anuncio. Inténtalo de nuevo." },
        { status: 503 }
      );
    }
    if (isDemoListing(reportListing)) {
      return privateJson(
        { error: "Los acuerdos de demostración no generan incidencias reales." },
        { status: 409 }
      );
    }

    const { data, error } = await admin.rpc("server_dispute_agreement", {
      p_actor_id: user.id,
      p_agreement_id: agreementId,
      p_note: `${reasonLabel}\n${details}`,
    });

    if (error) {
      const message = error.message || "No se pudo reportar.";
      const lower = message.toLowerCase();

      if (lower.includes("agreement not found")) {
        return privateJson({ error: "No se encontró el acuerdo." }, { status: 404 });
      }
      if (lower.includes("not allowed")) {
        return privateJson({ error: "No puedes reportar este acuerdo." }, { status: 403 });
      }
      if (lower.includes("only confirmed agreements")) {
        return privateJson(
          { error: "Solo puedes abrir una incidencia del acuerdo después de confirmarlo." },
          { status: 409 }
        );
      }

      throw error;
    }

    const agreement = normalizeRpcRow<any>(data);
    return privateJson({ ok: true, agreement });
  } catch {
    console.error("agreement_dispute_failed");
    return privateJson({ error: "No se pudo reportar el acuerdo." }, { status: 500 });
  }
}
