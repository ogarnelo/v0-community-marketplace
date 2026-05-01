import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { paymentIntentId, rating, comment } = body;

  const { data: payment } = await supabase
    .from("payment_intents")
    .select("buyer_id, seller_id")
    .eq("id", paymentIntentId)
    .single();

  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  const reviewedUserId = user.id === payment.buyer_id ? payment.seller_id : payment.buyer_id;

  const { error } = await supabase.from("transaction_reviews").insert({
    payment_intent_id: paymentIntentId,
    reviewer_id: user.id,
    reviewed_user_id: reviewedUserId,
    rating,
    comment,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
