import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLegacyCommerceEnabled } from "@/lib/launch/feature-gates";

export const dynamic = "force-dynamic";

type CheckoutEventType =
  | "checkout.session.completed"
  | "checkout.session.async_payment_succeeded"
  | "checkout.session.async_payment_failed";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-11-17.clover",
  });
}

function isCheckoutEventType(value: string): value is CheckoutEventType {
  return (
    value === "checkout.session.completed" ||
    value === "checkout.session.async_payment_succeeded" ||
    value === "checkout.session.async_payment_failed"
  );
}

function getProviderPaymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id || null;
}

function getNextPaymentStatus(
  eventType: CheckoutEventType,
  session: Stripe.Checkout.Session
) {
  if (eventType === "checkout.session.async_payment_succeeded") return "succeeded";
  if (eventType === "checkout.session.async_payment_failed") return "failed";
  return session.payment_status === "paid" ? "succeeded" : "processing";
}

async function processCheckoutSessionEvent(
  event: Stripe.Event,
  eventType: CheckoutEventType,
  session: Stripe.Checkout.Session
) {
  const offerId = session.metadata?.offer_id?.trim();
  const buyerId = session.metadata?.buyer_id?.trim();

  if (!offerId || !buyerId) {
    return { ignored: true, reason: "missing_checkout_metadata" as const };
  }

  const admin = createAdminClient();
  const { data: paymentIntent, error: paymentLookupError } = await admin
    .from("payment_intents")
    .select("id, listing_id, buyer_id, offer_id, status, metadata")
    .eq("offer_id", offerId)
    .eq("buyer_id", buyerId)
    .maybeSingle();

  if (paymentLookupError) {
    throw paymentLookupError;
  }

  if (!paymentIntent) {
    return { ignored: true, reason: "payment_intent_not_found" as const };
  }

  if (
    session.metadata?.listing_id &&
    session.metadata.listing_id !== paymentIntent.listing_id
  ) {
    throw new Error("Stripe checkout listing does not match the payment intent.");
  }

  const expectedTotal = Number(paymentIntent.metadata?.total_buyer_amount);
  if (
    Number.isFinite(expectedTotal) &&
    expectedTotal > 0 &&
    session.amount_total !== Math.round(expectedTotal * 100)
  ) {
    throw new Error("Stripe checkout total does not match the payment intent.");
  }

  const nextStatus = getNextPaymentStatus(eventType, session);
  const now = new Date().toISOString();
  let paymentUpdate = admin
    .from("payment_intents")
    .update({
      status: nextStatus,
      provider_payment_intent_id: getProviderPaymentIntentId(session),
      updated_at: now,
    })
    .eq("id", paymentIntent.id);

  if (nextStatus !== "succeeded") {
    paymentUpdate = paymentUpdate.neq("status", "succeeded");
  }

  const { error: paymentUpdateError } = await paymentUpdate;
  if (paymentUpdateError) {
    throw paymentUpdateError;
  }

  if (nextStatus === "succeeded" && paymentIntent.listing_id) {
    const { error: listingUpdateError } = await admin
      .from("listings")
      .update({ status: "sold" })
      .eq("id", paymentIntent.listing_id)
      .in("status", ["available", "reserved"]);

    if (listingUpdateError) {
      throw listingUpdateError;
    }
  }

  const { error: eventInsertError } = await admin.from("payment_events").insert({
    payment_intent_id: paymentIntent.id,
    event_type: eventType,
    provider_event_id: event.id,
    payload: {
      checkout_session_id: session.id,
      payment_status: session.payment_status,
      session_status: session.status,
      livemode: event.livemode,
    },
  });

  if (eventInsertError && eventInsertError.code !== "23505") {
    throw eventInsertError;
  }

  return {
    ignored: false,
    duplicate: eventInsertError?.code === "23505",
    paymentIntentId: paymentIntent.id,
    status: nextStatus,
  };
}

export async function POST(request: Request) {
  if (!isLegacyCommerceEnabled()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe webhook is not configured for this environment.",
      },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid Stripe webhook signature.",
      },
      { status: 400 }
    );
  }

  try {
    if (isCheckoutEventType(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await processCheckoutSessionEvent(event, event.type, session);
      return NextResponse.json({ ok: true, received: true, ...result });
    }

    return NextResponse.json({ ok: true, received: true, ignored: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", {
      eventId: event.id,
      eventType: event.type,
      error,
    });

    return NextResponse.json(
      { ok: false, error: "Stripe webhook processing failed." },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (!isLegacyCommerceEnabled()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      route: "/api/stripe/webhook",
      configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
      commerce_enabled: true,
    },
    { status: 200 }
  );
}
