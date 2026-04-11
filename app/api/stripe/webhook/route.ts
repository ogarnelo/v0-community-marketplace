import { headers } from "next/headers"
import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

async function releaseListingIfNoActivePayment(supabase: ReturnType<typeof createAdminClient>, offerId: string, listingId: string) {
  const { data: activePayments } = await supabase
    .from("payment_intents")
    .select("id")
    .eq("listing_id", listingId)
    .in("status", ["requires_payment_method", "processing", "paid"])
    .limit(1)

  if (!activePayments || activePayments.length === 0) {
    await supabase.from("listings").update({ status: "available" }).eq("id", listingId).eq("status", "reserved")
  }

  await supabase
    .from("listing_offers")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", offerId)
}

export async function POST(request: Request) {
  const signature = (await headers()).get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook no configurado." }, { status: 400 })
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Firma no válida." }, { status: 400 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session
    const offerId = session.metadata?.offer_id
    const listingId = session.metadata?.listing_id
    const providerPaymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null

    if (offerId) {
      const { data: currentPi } = await supabase
        .from("payment_intents")
        .select("metadata")
        .eq("offer_id", offerId)
        .maybeSingle()

      await supabase
        .from("payment_intents")
        .update({
          status: "paid",
          provider_payment_intent_id: providerPaymentIntentId,
          metadata: {
            ...(currentPi?.metadata || {}),
            paid_at: now,
            stripe_checkout_session_id: session.id,
          },
          updated_at: now,
        })
        .eq("offer_id", offerId)

      await supabase
        .from("listing_offers")
        .update({ status: "accepted", responded_at: now })
        .eq("id", offerId)
    }

    if (listingId) {
      await supabase.from("listings").update({ status: "sold" }).eq("id", listingId)
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session
    const offerId = session.metadata?.offer_id
    const listingId = session.metadata?.listing_id

    if (offerId) {
      await supabase
        .from("payment_intents")
        .update({ status: "cancelled", updated_at: now })
        .eq("offer_id", offerId)
    }

    if (offerId && listingId) {
      await releaseListingIfNoActivePayment(supabase, offerId, listingId)
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const offerId = paymentIntent.metadata?.offer_id
    const listingId = paymentIntent.metadata?.listing_id

    if (offerId) {
      await supabase
        .from("payment_intents")
        .update({
          status: "failed",
          provider_payment_intent_id: paymentIntent.id,
          updated_at: now,
        })
        .eq("offer_id", offerId)
    }

    if (offerId && listingId) {
      await releaseListingIfNoActivePayment(supabase, offerId, listingId)
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge
    const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null

    if (paymentIntentId) {
      const { data: rows } = await supabase
        .from("payment_intents")
        .select("offer_id, listing_id")
        .eq("provider_payment_intent_id", paymentIntentId)
        .limit(1)

      await supabase
        .from("payment_intents")
        .update({ status: "refunded", updated_at: now })
        .eq("provider_payment_intent_id", paymentIntentId)

      const row = rows?.[0]
      if (row?.listing_id) {
        await supabase.from("listings").update({ status: "available" }).eq("id", row.listing_id).eq("status", "sold")
      }
      if (row?.offer_id) {
        await supabase.from("listing_offers").update({ status: "accepted", responded_at: now }).eq("id", row.offer_id)
      }
    }
  }

  return NextResponse.json({ received: true })
}
