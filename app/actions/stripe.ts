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

  console.log("[v0] startCheckoutSession called with:", { offerId, deliveryMethod, shipmentTier })

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  console.log("[v0] Auth check:", { userId: user?.id, authError: authError?.message })

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

  console.log("[v0] Offer query result:", { 
    offerExists: !!typedOffer, 
    offerError: offerError?.message,
    offerStatus: typedOffer?.status,
    buyerId: typedOffer?.buyer_id,
    currentUserId: user.id
  })

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

  console.log("[v0] Creating Stripe checkout session with pricing:", pricing)
  console.log("[v0] NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL)
  
  let session
  try {
    session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      redirect_on_completion: 'never',
      mode: 'payment',
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://v0-community-marketplace-7r8pex7jm-garnelo.vercel.app'}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
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
    
    console.log("[v0] Stripe session created:", { sessionId: session.id, hasClientSecret: !!session.client_secret })
  } catch (stripeError: unknown) {
    const errorMessage = stripeError instanceof Error ? stripeError.message : 'Error desconocido de Stripe'
    console.error("[v0] Stripe checkout session error:", errorMessage)
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

  console.log("[v0] Returning client secret successfully")

  return {
    clientSecret: session.client_secret,
    sessionId: session.id,
  }
}
