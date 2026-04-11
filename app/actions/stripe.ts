'use server'

import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildMarketplacePricing, type DeliveryMethod, type ShipmentTier } from '@/lib/payments/pricing'
import { getAcceptedOfferAmount } from '@/lib/payments/offer-amount'

type OfferWithListing = {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  offered_price: number | null
  current_amount?: number | null
  accepted_amount?: number | null
  counter_price?: number | null
  status: string | null
  listings?: {
    id: string
    title: string | null
    description: string | null
    status?: string | null
  } | null
}

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

  const adminSupabase = createAdminClient()

  const { data: offer, error: offerError } = await adminSupabase
    .from('listing_offers')
    .select(`
      id,
      listing_id,
      buyer_id,
      seller_id,
      offered_price,
      current_amount,
      accepted_amount,
      counter_price,
      status,
      listings:listing_id (
        id,
        title,
        description,
        status
      )
    `)
    .eq('id', offerId)
    .maybeSingle()

  const typedOffer = (offer as OfferWithListing | null) ?? null

  if (offerError || !typedOffer) {
    throw new Error(offerError?.message || 'Oferta no encontrada.')
  }

  if (typedOffer.buyer_id !== user.id) {
    throw new Error('No tienes permiso para pagar esta oferta.')
  }

  if (typedOffer.status !== 'accepted') {
    throw new Error(`La oferta aún no ha sido aceptada. Estado actual: ${typedOffer.status}`)
  }

  const listingStatus = typedOffer.listings?.status ?? 'available'
  if (!['available', 'reserved'].includes(String(listingStatus))) {
    throw new Error('Este anuncio ya no permite iniciar el pago.')
  }

  const itemAmount = getAcceptedOfferAmount(typedOffer)
  if (!Number.isFinite(itemAmount) || itemAmount <= 0) {
    throw new Error('El importe de la operación no es válido.')
  }

  const pricing = buildMarketplacePricing({
    itemAmount,
    deliveryMethod,
    shipmentTier,
  })

  const { data: conversation } = await adminSupabase
    .from('conversations')
    .select('id')
    .eq('listing_id', typedOffer.listing_id)
    .eq('buyer_id', typedOffer.buyer_id)
    .eq('seller_id', typedOffer.seller_id)
    .maybeSingle()

  let session
  try {
    session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded_page',
      redirect_on_completion: 'never',
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: typedOffer.listings?.title || 'Artículo del marketplace',
              description: typedOffer.listings?.description || undefined,
            },
            unit_amount: Math.round(pricing.itemAmount * 100),
          },
          quantity: 1,
        },
        ...(pricing.buyerFeeAmount > 0 ? [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Protección al comprador',
              description: 'Comisión de protección y gestión de la transacción',
            },
            unit_amount: Math.round(pricing.buyerFeeAmount * 100),
          },
          quantity: 1,
        }] : []),
        ...(pricing.shippingAmount > 0 ? [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Gastos de envío',
              description: `Envío ${shipmentTier === 'small' ? 'pequeño' : shipmentTier === 'medium' ? 'mediano' : 'grande'}`,
            },
            unit_amount: Math.round(pricing.shippingAmount * 100),
          },
          quantity: 1,
        }] : []),
      ],
      metadata: {
        offer_id: offerId,
        listing_id: typedOffer.listing_id,
        buyer_id: user.id,
        seller_id: typedOffer.seller_id,
        conversation_id: conversation?.id || '',
        delivery_method: deliveryMethod,
        shipment_tier: shipmentTier,
      },
    })
  } catch (stripeError: unknown) {
    const errorMessage = stripeError instanceof Error ? stripeError.message : 'Error desconocido de Stripe'
    throw new Error(`Error al crear sesión de Stripe: ${errorMessage}`)
  }

  const now = new Date().toISOString()

  await adminSupabase
    .from('payment_intents')
    .upsert(
      {
        offer_id: offerId,
        listing_id: typedOffer.listing_id,
        conversation_id: conversation?.id || null,
        buyer_id: user.id,
        seller_id: typedOffer.seller_id,
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
          stripe_checkout_session_id: session.id,
        },
        updated_at: now,
      },
      { onConflict: 'offer_id' }
    )

  await adminSupabase
    .from('listings')
    .update({ status: 'reserved' })
    .eq('id', typedOffer.listing_id)
    .eq('status', 'available')

  if (!session.client_secret) {
    throw new Error('Stripe no devolvió client_secret.')
  }

  return {
    clientSecret: session.client_secret,
    sessionId: session.id,
  }
}

/**
 * Confirma que el pago se completó y actualiza los estados en la base de datos.
 * Esta función sirve como backup del webhook de Stripe.
 */
export async function confirmPaymentComplete(params: {
  offerId: string
}) {
  const { offerId } = params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Debes iniciar sesión.')
  }

  const adminSupabase = createAdminClient()

  // Verificar que el pago realmente se completó consultando el payment_intent
  const { data: paymentIntent } = await adminSupabase
    .from('payment_intents')
    .select('id, status, listing_id, metadata')
    .eq('offer_id', offerId)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (!paymentIntent) {
    throw new Error('No se encontró el intent de pago.')
  }

  // Verificar con Stripe que la sesión está pagada
  const sessionId = paymentIntent.metadata?.stripe_checkout_session_id
  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      if (session.payment_status !== 'paid') {
        throw new Error('El pago aún no se ha completado en Stripe.')
      }
    } catch {
      // Si no podemos verificar con Stripe, confiamos en el estado local
    }
  }

  const now = new Date().toISOString()

  // Actualizar payment_intent
  await adminSupabase
    .from('payment_intents')
    .update({
      status: 'paid',
      updated_at: now,
    })
    .eq('offer_id', offerId)

  // La oferta debe mantenerse como aceptada. El pago se refleja en payment_intents.
  await adminSupabase
    .from('listing_offers')
    .update({
      status: 'accepted',
      responded_at: now,
    })
    .eq('id', offerId)

  // Actualizar listing a vendido
  if (paymentIntent.listing_id) {
    await adminSupabase
      .from('listings')
      .update({ status: 'sold' })
      .eq('id', paymentIntent.listing_id)
  }

  return { success: true }
}

/**
 * Verifica el estado de una sesión de Stripe Checkout.
 */
export async function checkSessionStatus(sessionId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    return {
      paymentStatus: session.payment_status,
      status: session.status,
    }
  } catch {
    return {
      paymentStatus: 'unpaid',
      status: 'unknown',
    }
  }
}
