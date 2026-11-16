import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}


import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoListing } from "@/lib/seo/demo-listing";

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
    if (!user) return privateJson({ error: "Debes iniciar sesión." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const agreementId = typeof body?.agreementId === "string" ? body.agreementId.trim() : "";
    const rating = Number(body?.rating);
    const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 600) : null;
    if (!agreementId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return privateJson({ error: "La valoración no es válida." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: agreement, error: agreementError } = await admin.from("agreements").select("*").eq("id", agreementId).maybeSingle();
    if (agreementError) return privateJson({ error: "No se pudo verificar el acuerdo." }, { status: 503 });
    if (!agreement) return privateJson({ error: "No se encontró el acuerdo." }, { status: 404 });
    if (agreement.status !== "confirmed") return privateJson({ error: "Solo puedes valorar acuerdos confirmados." }, { status: 409 });
    if (agreement.buyer_id !== user.id && agreement.seller_id !== user.id) return privateJson({ error: "No puedes valorar este acuerdo." }, { status: 403 });

    // Reviews of controlled DEMO agreements are stored for E2E verification,
    // but must not affect public user reputation or badges.
    const { data: reviewedListing, error: listingError } = await admin
      .from("listings")
      .select("id,title")
      .eq("id", agreement.listing_id)
      .maybeSingle();
    if (listingError || !reviewedListing) {
      console.error("No se pudo determinar si la valoración es de prueba", listingError);
      return privateJson({ error: "No se pudo verificar el anuncio de la valoración." }, { status: 503 });
    }
    const reviewStatus = isDemoListing(reviewedListing) ? "hidden" : "published";

    const reviewedUserId = user.id === agreement.buyer_id ? agreement.seller_id : agreement.buyer_id;
    const { data: existing, error: existingError } = await admin.from("agreement_reviews").select("id").eq("agreement_id", agreement.id).eq("reviewer_id", user.id).maybeSingle();
    if (existingError) return privateJson({ error: "No se pudo verificar tu valoración." }, { status: 503 });
    if (existing?.id) return privateJson({ error: "Ya has valorado este acuerdo." }, { status: 409 });

    const { data: review, error } = await admin.from("agreement_reviews").insert({ agreement_id: agreement.id, listing_id: agreement.listing_id, reviewer_id: user.id, reviewed_user_id: reviewedUserId, rating, comment, status: reviewStatus }).select("*").single();
    if (error || !review) return privateJson({ error: "No se pudo guardar la valoración." }, { status: 500 });

    await admin.from("agreement_events").insert({ agreement_id: agreement.id, actor_id: user.id, event_type: "agreement_reviewed", metadata: { rating } });
    return privateJson({ ok: true, review });
  } catch {
    console.error("agreement_review_failed");
    return privateJson({ error: "No se pudo guardar la valoración." }, { status: 500 });
  }
}
