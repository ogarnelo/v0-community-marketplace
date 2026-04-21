
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    const body = await request.json();
    const paymentIntentId = typeof body?.paymentIntentId === "string" ? body.paymentIntentId.trim() : "";
    const rating = Number(body?.rating);
    const comment = typeof body?.comment === "string" ? body.comment.trim() : "";

    if (!paymentIntentId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "La valoración no es válida." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: payment, error: paymentError } = await admin
      .from("payment_intents")
      .select("id, listing_id, buyer_id, seller_id, status")
      .eq("id", paymentIntentId)
      .maybeSingle();

    if (paymentError || !payment) {
      return NextResponse.json({ error: "Operación no encontrada." }, { status: 404 });
    }

    if (payment.status !== "paid") {
      return NextResponse.json({ error: "Solo puedes valorar operaciones pagadas." }, { status: 400 });
    }

    const isBuyer = payment.buyer_id === user.id;
    const isSeller = payment.seller_id === user.id;

    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: "No tienes permiso para valorar esta operación." }, { status: 403 });
    }

    const reviewedUserId = isBuyer ? payment.seller_id : payment.buyer_id;
    if (!reviewedUserId) {
      return NextResponse.json({ error: "No se ha podido identificar al otro usuario." }, { status: 400 });
    }

    const { data: existing } = await admin
      .from("reviews")
      .select("id")
      .eq("reviewer_id", user.id)
      .eq("reviewed_user_id", reviewedUserId)
      .eq("listing_id", payment.listing_id)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ error: "Ya has dejado una valoración para esta operación." }, { status: 409 });
    }

    const { error: insertError } = await admin
      .from("reviews")
      .insert({
        reviewer_id: user.id,
        reviewed_user_id: reviewedUserId,
        listing_id: payment.listing_id,
        rating,
        comment: comment || null,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message || "No se pudo guardar la valoración." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo crear la valoración." }, { status: 500 });
  }
}
