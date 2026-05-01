import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { getBoostPlan } from "@/lib/boosts/pricing";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const listingId = String(body?.listingId || "");
  const planId = String(body?.planId || "boost_7_days");
  const plan = getBoostPlan(planId);

  if (!listingId) {
    return NextResponse.json({ error: "Missing listing id" }, { status: 400 });
  }

  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, title, seller_id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (error || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.seller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (listing.status !== "available") {
    return NextResponse.json(
      { error: "Solo puedes destacar anuncios disponibles." },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    success_url: `${appUrl}/boosts/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/boosts/${listing.id}?cancelled=1`,
    customer_email: user.email || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: plan.currency,
          unit_amount: plan.amountCents,
          product_data: {
            name: plan.name,
            description: `${plan.description} Anuncio: ${listing.title || listing.id}`,
          },
        },
      },
    ],
    metadata: {
      type: "listing_boost",
      listing_id: listing.id,
      user_id: user.id,
      plan_id: plan.id,
      days: String(plan.days),
    },
  });

  return NextResponse.json({ ok: true, url: session.url });
}
