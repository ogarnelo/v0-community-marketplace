import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const REVIEWABLE_PAYMENT_STATUSES = new Set(["paid", "completed", "succeeded"]);

function cleanComment(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 1000);
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const paymentIntentId = typeof body?.paymentIntentId === "string" ? body.paymentIntentId : "";
  const rating = Number(body?.rating);
  const comment = cleanComment(body?.comment);

  if (!paymentIntentId) {
    return NextResponse.json({ error: "Falta la operación a valorar." }, { status: 400 });
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "La valoración debe estar entre 1 y 5." }, { status: 400 });
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payment_intents")
    .select("id, buyer_id, seller_id, status")
    .eq("id", paymentIntentId)
    .maybeSingle();

  if (paymentError || !payment) {
    return NextResponse.json({ error: "Operación no encontrada." }, { status: 404 });
  }

  const isBuyer = user.id === payment.buyer_id;
  const isSeller = user.id === payment.seller_id;

  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: "No puedes valorar esta operación." }, { status: 403 });
  }

  if (!REVIEWABLE_PAYMENT_STATUSES.has(payment.status)) {
    return NextResponse.json(
      { error: "Solo puedes valorar operaciones pagadas o completadas." },
      { status: 400 }
    );
  }

  const reviewedUserId = isBuyer ? payment.seller_id : payment.buyer_id;

  if (!reviewedUserId || reviewedUserId === user.id) {
    return NextResponse.json({ error: "No se pudo identificar al usuario valorado." }, { status: 400 });
  }

  const { error } = await supabase.from("transaction_reviews").insert({
    payment_intent_id: paymentIntentId,
    reviewer_id: user.id,
    reviewed_user_id: reviewedUserId,
    rating,
    comment,
  });

  if (error) {
    console.error("review_create_error", error);
    return NextResponse.json(
      { error: "No se pudo guardar la valoración. Puede que ya hayas valorado esta operación." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
