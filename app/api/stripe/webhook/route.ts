import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type StripeMetadata = {
  offer_id?: string;
  listing_id?: string;
  payment_intent_row_id?: string;
};

function mergeMetadata(current: Record<string, any> | null | undefined, next: Record<string, any>) {
  return {
    ...(current ?? {}),
    ...next,
  };
}

async function releaseListingIfNoActivePayments(params: {
  admin: ReturnType<typeof createAdminClient>;
  listingId: string;
  currentPaymentIntentId?: string | null;
}) {
  const { admin, listingId, currentPaymentIntentId } = params;

  const { data: listing } = await admin
    .from("listings")
    .select("id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing || listing.status === "sold" || listing.status === "archived") {
    return;
  }

  const activeStatuses = ["requires_payment_method", "processing", "paid"];

  let query = admin
    .from("payment_intents")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .in("status", activeStatuses);

  if (currentPaymentIntentId) {
    query = query.neq("id", currentPaymentIntentId);
  }

  const { count } = await query;

  if (!count || count === 0) {
    await admin.from("listings").update({ status: "available" }).eq("id", listingId).eq("status", "reserved");
  }
}

async function syncCheckoutSession(session: Stripe.Checkout.Session) {
  const admin = createAdminClient();
  const metadata = (session.metadata ?? {}) as StripeMetadata;
  const offerId = metadata.offer_id;
  const listingId = metadata.listing_id;

  if (!offerId || !listingId) {
    return;
  }

  const { data: paymentIntentRow } = await admin
    .from("payment_intents")
    .select("id, metadata")
    .eq("offer_id", offerId)
    .maybeSingle();

  const nextMetadata = mergeMetadata(paymentIntentRow?.metadata as Record<string, any> | null, {
    stripe_checkout_session_id: session.id,
    stripe_checkout_status: session.status,
    stripe_payment_status: session.payment_status,
  });

  const commonUpdate = {
    provider_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    metadata: nextMetadata,
    updated_at: new Date().toISOString(),
  };

  if (session.payment_status === "paid") {
    await admin
      .from("payment_intents")
      .update({
        ...commonUpdate,
        status: "paid",
      })
      .eq("offer_id", offerId);

    await admin
      .from("listings")
      .update({ status: "sold" })
      .eq("id", listingId)
      .in("status", ["available", "reserved"]);

    return;
  }

  if (session.status === "expired") {
    await admin
      .from("payment_intents")
      .update({
        ...commonUpdate,
        status: "cancelled",
      })
      .eq("offer_id", offerId);

    await releaseListingIfNoActivePayments({
      admin,
      listingId,
      currentPaymentIntentId: paymentIntentRow?.id,
    });

    return;
  }

  await admin
    .from("payment_intents")
    .update({
      ...commonUpdate,
      status: session.status === "complete" ? "processing" : "requires_payment_method",
    })
    .eq("offer_id", offerId);
}

async function syncPaymentIntentFailure(paymentIntent: Stripe.PaymentIntent) {
  const admin = createAdminClient();
  const offerId = paymentIntent.metadata?.offer_id;
  const listingId = paymentIntent.metadata?.listing_id;

  if (!offerId || !listingId) {
    return;
  }

  const { data: paymentIntentRow } = await admin
    .from("payment_intents")
    .select("id, metadata")
    .eq("offer_id", offerId)
    .maybeSingle();

  await admin
    .from("payment_intents")
    .update({
      provider_payment_intent_id: paymentIntent.id,
      status: "failed",
      metadata: mergeMetadata(paymentIntentRow?.metadata as Record<string, any> | null, {
        stripe_last_payment_error: paymentIntent.last_payment_error?.message || null,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("offer_id", offerId);

  await releaseListingIfNoActivePayments({
    admin,
    listingId,
    currentPaymentIntentId: paymentIntentRow?.id,
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook de Stripe no configurado." }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Firma inválida." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await syncCheckoutSession(session);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await syncPaymentIntentFailure(paymentIntent);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo procesar el webhook." },
      { status: 500 }
    );
  }
}
