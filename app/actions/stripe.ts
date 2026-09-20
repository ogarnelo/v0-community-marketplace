'use server'

import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildMarketplacePricing, type DeliveryMethod, type ShipmentTier } from '@/lib/payments/pricing'
import { getAcceptedOfferAmount } from '@/lib/payments/offer-amount'
import { isLegacyCommerceEnabled } from '@/lib/launch/feature-gates'

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
  if (!isLegacyCommerceEnabled()) {
    throw new Error('Esta función no está activa durante el lanzamiento inicial de Wetudy.')
  }

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
  if (!isLegacyCommerceEnabled()) {
    throw new Error('Esta función no está activa durante el lanzamiento inicial de Wetudy.')
  }

  const { offerId } = params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Debes iniciar sesión.')
  }

  const adminSupabase = createAdminClient()

  const { data: paymentIntent, error: paymentLookupError } = await adminSupabase
    .from('payment_intents')
    .select('id, status, listing_id, metadata')
    .eq('offer_id', offerId)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (paymentLookupError || !paymentIntent) {
    throw new Error(paymentLookupError?.message || 'No se encontró el intent de pago.')
  }

  const sessionId = paymentIntent.metadata?.stripe_checkout_session_id
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('No se encontró una sesión de Stripe asociada al pago.')
  }

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo verificar el pago con Stripe.'
    throw new Error(`No se pudo verificar el pago con Stripe: ${message}`)
  }

  if (session.payment_status !== 'paid') {
    throw new Error('El pago aún no se ha completado en Stripe.')
  }

  if (session.metadata?.offer_id !== offerId || session.metadata?.buyer_id !== user.id) {
    throw new Error('La sesión de Stripe no corresponde a esta operación.')
  }

  const expectedTotal = Number(paymentIntent.metadata?.total_buyer_amount)
  if (
    Number.isFinite(expectedTotal) &&
    expectedTotal > 0 &&
    session.amount_total !== Math.round(expectedTotal * 100)
  ) {
    throw new Error('El importe confirmado por Stripe no coincide con la operación.')
  }

  const now = new Date().toISOString()

  const { error: paymentUpdateError } = await adminSupabase
    .from('payment_intents')
    .update({
      status: 'succeeded',
      updated_at: now,
    })
    .eq('id', paymentIntent.id)
    .eq('buyer_id', user.id)

  if (paymentUpdateError) {
    throw new Error(paymentUpdateError.message || 'No se pudo actualizar el estado del pago.')
  }

  const { error: offerUpdateError } = await adminSupabase
    .from('listing_offers')
    .update({
      status: 'accepted',
      responded_at: now,
    })
    .eq('id', offerId)
    .eq('buyer_id', user.id)

  if (offerUpdateError) {
    throw new Error(offerUpdateError.message || 'No se pudo actualizar la oferta.')
  }

  if (paymentIntent.listing_id) {
    const { error: listingUpdateError } = await adminSupabase
      .from('listings')
      .update({ status: 'sold' })
      .eq('id', paymentIntent.listing_id)

    if (listingUpdateError) {
      throw new Error(listingUpdateError.message || 'No se pudo actualizar el anuncio.')
    }
  }

  return { success: true }
}

/**
 * Verifica el estado de una sesión de Stripe Checkout.
 */
export async function checkSessionStatus(sessionId: string) {
  if (!isLegacyCommerceEnabled()) {
    return { paymentStatus: 'unavailable', status: 'disabled' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Debes iniciar sesión.')
  }

  const adminSupabase = createAdminClient()
  const { data: ownedPayment, error: paymentLookupError } = await adminSupabase
    .from('payment_intents')
    .select('id')
    .eq('buyer_id', user.id)
    .contains('metadata', { stripe_checkout_session_id: sessionId })
    .maybeSingle()

  if (paymentLookupError || !ownedPayment) {
    throw new Error('No puedes consultar esta sesión de pago.')
  }

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
