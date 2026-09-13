import { NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-11-17.clover",
  });
}

export async function POST(request: Request) {
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

  // MVP: payments are intentionally not part of the visible launch flow.
  // Keep the webhook safe and buildable, but do not make checkout a launch dependency.
  switch (event.type) {
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "checkout.session.completed":
      break;
    default:
      break;
  }

  return NextResponse.json({ ok: true, received: true });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/stripe/webhook",
      configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
      mvp_note: "Stripe is kept non-blocking for the MVP. The visible MVP flow is contact and offline agreement.",
    },
    { status: 200 }
  );
}
