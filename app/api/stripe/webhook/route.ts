import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertStripeTestMode, isPrivateCommercePreviewEnabled, isPublicCommerceEnabled } from "@/lib/commerce/private-access";
import { syncSellerConnectAccountSnapshot } from "@/lib/commerce/connect";

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

async function processConnectAccountUpdated(event: Stripe.Event) {
  if (!isPrivateCommercePreviewEnabled() || event.livemode) {
    return { ignored: true, reason: "connect_private_test_only" as const };
  }

  const account = event.data.object as Stripe.Account;
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("seller_connect_accounts")
    .select("user_id")
    .eq("stripe_account_id", account.id)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!existing?.user_id) {
    return { ignored: true, reason: "connect_account_not_registered" as const };
  }

  const { status } = await syncSellerConnectAccountSnapshot({
    userId: existing.user_id,
    account: account as any,
  });

  return {
    ignored: false,
    stripeAccountId: account.id,
    onboardingStatus: status.onboardingStatus,
    transfersActive: status.transfersActive,
    payoutsEnabled: status.payoutsEnabled,
  };
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
    .select("id, listing_id, conversation_id, buyer_id, seller_id, offer_id, status, provider, currency, amount, buyer_fee_amount, shipping_amount, shipment_tier, metadata")
    .eq("offer_id", offerId)
    .eq("buyer_id", buyerId)
    .maybeSingle();

  if (paymentLookupError) {
    throw paymentLookupError;
  }

  if (!paymentIntent) {
    return { ignored: true, reason: "payment_intent_not_found" as const };
  }

  // Only the Stripe Checkout session created and registered for this
  // payment is authorized to mutate it. Legacy/incomplete records require
  // manual reconciliation, not an inferred ownership or a missing-amount bypass.
  const registeredSessionId = paymentIntent.metadata?.stripe_checkout_session_id;
  const expectedTotal = paymentIntent.metadata?.total_buyer_amount;
  const itemAmount = paymentIntent.amount;
  const fee = paymentIntent.buyer_fee_amount;
  const shipping = paymentIntent.shipping_amount;
  const cents = (value: number) => Math.round(value * 100);
  if (typeof registeredSessionId !== "string" || !registeredSessionId ||
      registeredSessionId !== session.id) {
    throw new Error("Stripe checkout session does not match the registered session.");
  }
  if (paymentIntent.provider !== "stripe" || paymentIntent.currency !== "EUR" ||
      paymentIntent.metadata?.source !== "stripe_checkout" ||
      paymentIntent.offer_id !== offerId || paymentIntent.buyer_id !== buyerId ||
      !paymentIntent.listing_id || !paymentIntent.seller_id ||
      session.metadata?.seller_id !== paymentIntent.seller_id ||
      session.metadata?.listing_id !== paymentIntent.listing_id ||
      session.metadata?.offer_id !== paymentIntent.offer_id ||
      session.metadata?.buyer_id !== paymentIntent.buyer_id ||
      session.currency !== "eur") {
    throw new Error("Stripe checkout identity or currency does not match the payment intent.");
  }
  if (typeof expectedTotal !== "number" ||
      [itemAmount, fee, shipping].some(v => v === null || v === undefined || v === "") ||
      ![Number(itemAmount),Number(fee),Number(shipping),expectedTotal].every(Number.isFinite) ||
      Number(itemAmount) <= 0 || Number(fee) < 0 || Number(shipping) < 0 ||
      expectedTotal <= 0 || !Number.isSafeInteger(cents(expectedTotal)) ||
      cents(Number(itemAmount)) + cents(Number(fee)) + cents(Number(shipping)) !== cents(expectedTotal) ||
      session.amount_total !== cents(expectedTotal)) {
    throw new Error("Stripe checkout total does not match the payment intent.");
  }
  if (eventType === "checkout.session.async_payment_succeeded" &&
      session.payment_status !== "paid") {
    throw new Error("Stripe asynchronous success event has no paid confirmation.");
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

  if (
    nextStatus === "succeeded" &&
    paymentIntent.metadata?.delivery_method === "shipping"
  ) {
    const { data: existingShipment, error: shipmentLookupError } = await admin
      .from("shipments")
      .select("id")
      .eq("payment_intent_id", paymentIntent.id)
      .maybeSingle();

    if (shipmentLookupError) {
      throw shipmentLookupError;
    }

    if (!existingShipment) {
      const { error: shipmentInsertError } = await admin.from("shipments").insert({
        payment_intent_id: paymentIntent.id,
        listing_id: paymentIntent.listing_id,
        conversation_id: paymentIntent.conversation_id || null,
        buyer_id: paymentIntent.buyer_id,
        seller_id: paymentIntent.seller_id,
        provider: "internal_stub",
        shipment_tier: paymentIntent.shipment_tier || "small",
        status: "draft",
        shipping_amount: paymentIntent.shipping_amount || null,
        payload: {
          source: "stripe_webhook",
          checkout_session_id: session.id,
        },
        updated_at: now,
      });

      if (shipmentInsertError && shipmentInsertError.code !== "23505") {
        throw shipmentInsertError;
      }
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
  if (!isPublicCommerceEnabled() && !isPrivateCommercePreviewEnabled()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  if (!isPublicCommerceEnabled()) assertStripeTestMode();

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

  if (!isPublicCommerceEnabled() && event.livemode) {
    return NextResponse.json({ ok: false, error: "Live Stripe events are blocked in private preview." }, { status: 400 });
  }

  try {
    if (event.type === "account.updated") {
      const result = await processConnectAccountUpdated(event);
      return NextResponse.json({ ok: true, received: true, ...result });
    }

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

