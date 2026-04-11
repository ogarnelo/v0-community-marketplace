'use server'

import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { buildMarketplacePricing, type DeliveryMethod, type ShipmentTier } from '@/lib/payments/pricing'

export async function startCheckoutSession(params: {
  offerId: string
  deliveryMethod: DeliveryMethod
  shipmentTier: ShipmentTier
}) {
  const { offerId, deliveryMethod, shipmentTier } = params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Debes iniciar sesión para continuar.')
  }

  // Get the accepted offer
  const { data: offer, error: offerError } = await supabase
    .from('listing_offers')
    .select(`
      id,
      listing_id,
      buyer_id,
      seller_id,
      offered_price,
      current_amount,
      accepted_amount,
      status,
      listings:listing_id (
        id,
        title,
        description
      )
    `)
    .eq('id', offerId)
    .maybeSingle()

  if (offerError || !offer) {
    throw new Error(offerError?.message || 'Oferta no encontrada.')
  }

  if (offer.buyer_id !== user.id) {
    throw new Error('No tienes permiso para pagar esta oferta.')
  }

  if (offer.status !== 'accepted') {
    throw new Error('La oferta aún no ha sido aceptada.')
  }

  const itemAmount = Number(offer.accepted_amount ?? offer.current_amount ?? offer.offered_price ?? 0)
  if (!Number.isFinite(itemAmount) || itemAmount <= 0) {
    throw new Error('El importe de la operación no es válido.')
  }

  // Calculate pricing
  const pricing = buildMarketplacePricing({
    itemAmount,
    deliveryMethod,
    shipmentTier,
  })

  // Get listing details
  const listing = offer.listings as { id: string; title: string; description: string } | null

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    ui_mode: 'embedded',
    redirect_on_completion: 'never',
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: listing?.title || 'Artículo del marketplace',
            description: listing?.description || undefined,
          },
          unit_amount: Math.round(pricing.itemAmount * 100), // Convert to cents
        },
        quantity: 1,
      },
      ...(pricing.buyerFeeAmount > 0
        ? [
            {
              price_data: {
                currency: 'eur',
                product_data: {
                  name: 'Protección al comprador',
                  description: 'Comisión de protección y gestión de la transacción',
                },
                unit_amount: Math.round(pricing.buyerFeeAmount * 100),
              },
              quantity: 1,
            },
          ]
        : []),
      ...(pricing.shippingAmount > 0
        ? [
            {
              price_data: {
                currency: 'eur',
                product_data: {
                  name: 'Gastos de envío',
                  description: `Envío ${shipmentTier === 'small' ? 'pequeño' : shipmentTier === 'medium' ? 'mediano' : 'grande'}`,
                },
                unit_amount: Math.round(pricing.shippingAmount * 100),
              },
              quantity: 1,
            },
          ]
        : []),
    ],
    mode: 'payment',
    metadata: {
      offer_id: offerId,
      listing_id: offer.listing_id,
      buyer_id: user.id,
      seller_id: offer.seller_id,
      delivery_method: deliveryMethod,
      shipment_tier: shipmentTier,
    },
  })

  // Update payment intent in database
  const now = new Date().toISOString()
  await supabase.from('payment_intents').upsert(
    {
      offer_id: offerId,
      listing_id: offer.listing_id,
      buyer_id: user.id,
      seller_id: offer.seller_id,
      amount: pricing.itemAmount,
      currency: 'EUR',
      provider: 'stripe',
      status: 'pending',
      stripe_session_id: session.id,
      buyer_fee_amount: pricing.buyerFeeAmount,
      shipping_amount: pricing.shippingAmount,
      seller_net_amount: pricing.sellerNetAmount,
      platform_fee_amount: pricing.buyerFeeAmount,
      shipment_tier: pricing.shipmentTier,
      metadata: {
        source: 'stripe_checkout',
        delivery_method: pricing.deliveryMethod,
        total_buyer_amount: pricing.totalBuyerAmount,
      },
      updated_at: now,
    },
    { onConflict: 'offer_id' }
  )

  return session.client_secret
}

export async function getCheckoutSessionStatus(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  return {
    status: session.status,
    paymentStatus: session.payment_status,
    customerEmail: session.customer_details?.email,
  }
}
