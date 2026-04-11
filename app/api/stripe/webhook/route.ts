import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const signature = (await headers()).get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook no configurado.' }, { status: 400 })
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Firma no válida.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object as Stripe.Checkout.Session
    const offerId = session.metadata?.offer_id
    const listingId = session.metadata?.listing_id
    const providerPaymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null

    if (offerId) {
      // Actualizar payment_intent
      await supabase
        .from('payment_intents')
        .update({
          status: 'paid',
          provider_payment_intent_id: providerPaymentIntentId,
          updated_at: new Date().toISOString(),
        })
        .eq('offer_id', offerId)

      // Actualizar oferta a pagada
      await supabase
        .from('listing_offers')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', offerId)
    }

    if (listingId) {
      await supabase
        .from('listings')
        .update({ status: 'sold' })
        .eq('id', listingId)
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session
    const offerId = session.metadata?.offer_id
    const listingId = session.metadata?.listing_id

    if (offerId) {
      await supabase
        .from('payment_intents')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('offer_id', offerId)
    }

    if (listingId) {
      await supabase
        .from('listings')
        .update({ status: 'available' })
        .eq('id', listingId)
        .eq('status', 'reserved')
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const offerId = paymentIntent.metadata?.offer_id
    const listingId = paymentIntent.metadata?.listing_id

    if (offerId) {
      await supabase
        .from('payment_intents')
        .update({
          status: 'failed',
          provider_payment_intent_id: paymentIntent.id,
          updated_at: new Date().toISOString(),
        })
        .eq('offer_id', offerId)
    }

    if (listingId) {
      await supabase
        .from('listings')
        .update({ status: 'available' })
        .eq('id', listingId)
        .eq('status', 'reserved')
    }
  }

  return NextResponse.json({ received: true })
}
