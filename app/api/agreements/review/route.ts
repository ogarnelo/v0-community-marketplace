import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const agreementId = typeof body?.agreementId === "string" ? body.agreementId.trim() : "";
    const rating = Number(body?.rating);
    const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 600) : null;
    if (!agreementId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "La valoración no es válida." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: agreement } = await admin.from("agreements").select("*").eq("id", agreementId).maybeSingle();
    if (!agreement) return NextResponse.json({ error: "No se encontró el acuerdo." }, { status: 404 });
    if (agreement.status !== "confirmed") return NextResponse.json({ error: "Solo puedes valorar acuerdos confirmados." }, { status: 409 });
    if (agreement.buyer_id !== user.id && agreement.seller_id !== user.id) return NextResponse.json({ error: "No puedes valorar este acuerdo." }, { status: 403 });

    const reviewedUserId = user.id === agreement.buyer_id ? agreement.seller_id : agreement.buyer_id;
    const { data: existing } = await admin.from("agreement_reviews").select("id").eq("agreement_id", agreement.id).eq("reviewer_id", user.id).maybeSingle();
    if (existing?.id) return NextResponse.json({ error: "Ya has valorado este acuerdo." }, { status: 409 });

    const { data: review, error } = await admin.from("agreement_reviews").insert({ agreement_id: agreement.id, listing_id: agreement.listing_id, reviewer_id: user.id, reviewed_user_id: reviewedUserId, rating, comment, status: "published" }).select("*").single();
    if (error || !review) return NextResponse.json({ error: error?.message || "No se pudo guardar la valoración." }, { status: 500 });

    await admin.from("agreement_events").insert({ agreement_id: agreement.id, actor_id: user.id, event_type: "agreement_reviewed", metadata: { rating } });
    return NextResponse.json({ ok: true, review });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo guardar la valoración." }, { status: 500 });
  }
}
