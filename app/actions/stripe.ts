'use server'

import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildMarketplacePricing,
  type DeliveryMethod,
  type ShipmentTier,
} from '@/lib/payments/pricing'

function mergeMetadata(
  current: Record<string, any> | null | undefined,
  next: Record<string, any>
) {
  return {
    ...(current ?? {}),
    ...next,
  }
}

export async function startCheckoutSession(params: {
  offerId: string
  deliveryMethod: DeliveryMethod
  shipmentTier: ShipmentTier
}) {
  const { offerId, deliveryMethod, shipmentTier } = params

  const supabase = await createClient()
  const admin = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Debes iniciar sesión para continuar.')
  }

  const { data: offer, error: offerError } = await admin
    .from('listing_offers')
    .select(
      `
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
        description,
        school_id,
        status
      )
    `
    )
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

  const listing = offer.listings as {
    id: string
    title: string | null
    description: string | null
    school_id?: string | null
    status?: string | null
  } | null

  if (!listing) {
    throw new Error('El anuncio asociado ya no existe.')
  }

  if (!['available', 'reserved'].includes(String(listing.status ?? 'available'))) {
    throw new Error('Este anuncio ya no está disponible para pagar.')
  }

  const itemAmount = Number(
    offer.accepted_amount ?? offer.current_amount ?? offer.offered_price ?? 0
  )

  if (!Number.isFinite(itemAmount) || itemAmount <= 0) {
    throw new Error('El importe de la operación no es válido.')
  }

  const pricing = buildMarketplacePricing({
    itemAmount,
    deliveryMethod,
    shipmentTier,
  })

  const { data: conversation, error: conversationError } = await admin
    .from('conversations')
    .select('id')
    .eq('listing_id', offer.listing_id)
    .eq('buyer_id', offer.buyer_id)
    .eq('seller_id', offer.seller_id)
    .maybeSingle()

  if (conversationError) {
    throw new Error(conversationError.message || 'No se pudo recuperar la conversación.')
  }

  const now = new Date().toISOString()

  const { data: paymentIntent, error: paymentIntentError } = await admin
    .from('payment_intents')
    .upsert(
      {
        listing_id: offer.listing_id,
        conversation_id: conversation?.id || null,
        offer_id: offerId,
        buyer_id: user.id,
        seller_id: offer.seller_id,
        school_id: listing.school_id || null,
        amount: pricing.itemAmount,
        currency: 'EUR',
        provider: 'stripe',
        status: 'requires_payment_method',
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
    .select('id, metadata')
    .single()

  if (paymentIntentError || !paymentIntent) {
    throw new Error(paymentIntentError?.message || 'No se pudo preparar el pago.')
  }

  if (listing.status === 'available') {
    await admin
      .from('listings')
      .update({ status: 'reserved' })
      .eq('id', listing.id)
      .eq('status', 'available')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    throw new Error('Falta NEXT_PUBLIC_APP_URL en las variables de entorno.')
  }

  const session = await stripe.checkout.sessions.create({
    ui_mode: 'embedded',
    redirect_on_completion: 'never',
    mode: 'payment',
    client_reference_id: offerId,
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: listing.title || 'Artículo del marketplace',
            description: listing.description || undefined,
          },
          unit_amount: Math.round(pricing.itemAmount * 100),
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
                description: 'Comisión de gestión y protección de la transacción.',
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
                description:
                  pricing.shipmentTier === 'small'
                    ? 'Envío pequeño'
                    : pricing.shipmentTier === 'medium'
                      ? 'Envío mediano'
                      : 'Envío grande',
              },
              unit_amount: Math.round(pricing.shippingAmount * 100),
            },
            quantity: 1,
          },
        ]
        : []),
    ],
    metadata: {
      offer_id: offerId,
      listing_id: offer.listing_id,
      buyer_id: user.id,
      seller_id: offer.seller_id,
      conversation_id: conversation?.id || '',
      payment_intent_row_id: paymentIntent.id,
      delivery_method: pricing.deliveryMethod,
      shipment_tier: pricing.shipmentTier,
    },
    payment_intent_data: {
      metadata: {
        offer_id: offerId,
        listing_id: offer.listing_id,
      },
    },
    return_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  })

  const nextMetadata = mergeMetadata(paymentIntent.metadata as Record<string, any> | null, {
    stripe_checkout_session_id: session.id,
    stripe_checkout_status: session.status,
    stripe_payment_status: session.payment_status,
    total_buyer_amount: pricing.totalBuyerAmount,
  })

  const providerPaymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : null

  const { error: updateError } = await admin
    .from('payment_intents')
    .update({
      provider_payment_intent_id: providerPaymentIntentId,
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentIntent.id)

  if (updateError) {
    throw new Error(updateError.message || 'No se pudo guardar la sesión de Stripe.')
  }

  if (!session.client_secret) {
    throw new Error('Stripe no devolvió el client secret del checkout.')
  }

  return session.client_secret
}
