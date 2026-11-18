'use server'

import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildMarketplacePricing, isDeliveryMethod, isShipmentTier, type DeliveryMethod, type ShipmentTier } from '@/lib/payments/pricing'
import { getAcceptedOfferAmount } from '@/lib/payments/offer-amount'
import { canUserUseCommerce, isPublicCommerceEnabled, assertStripeTestMode } from '@/lib/commerce/private-access'

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
  // Server Action arguments are untrusted at runtime despite TypeScript types.
  // Reject a free-shipping tier and malformed selections before privileged
  // reads or an irreversible Stripe session request.
  if (typeof offerId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(offerId) ||
      !isDeliveryMethod(deliveryMethod) || !isShipmentTier(shipmentTier) ||
      (deliveryMethod === 'shipping' && shipmentTier === 'none') ||
      (deliveryMethod === 'in_person' && shipmentTier !== 'none')) {
    throw new Error('Parámetros de checkout inválidos.')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Debes iniciar sesión para continuar.')
  }

  if (!(await canUserUseCommerce(user))) {
    throw new Error('El checkout privado no está habilitado para esta cuenta.')
  }
  if (!isPublicCommerceEnabled()) assertStripeTestMode()

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

  const checkoutIdempotencyKey = [
    "wetudy-checkout-v1",
    offerId,
    deliveryMethod,
    shipmentTier,
  ].join(":")

  const expectedTotalCents = Math.round(pricing.totalBuyerAmount * 100)
  const { data: existingPayment, error: existingPaymentError } = await adminSupabase
    .from('payment_intents')
    .select('id, status, amount, currency, buyer_fee_amount, shipping_amount, seller_net_amount, conversation_id, shipment_tier, metadata, buyer_id, seller_id, listing_id, provider')
    .eq('offer_id', offerId)
    .maybeSingle()

  if (existingPaymentError) {
    throw new Error('No se pudo comprobar el checkout anterior.')
  }
  const exactCents = (stored: unknown, quoted: number) =>
    stored !== undefined && stored !== null &&
    Number.isFinite(Number(stored)) &&
    Math.round(Number(stored) * 100) === Math.round(quoted * 100)
  if (existingPayment && (
    existingPayment.status !== 'requires_payment_method' ||
    existingPayment.buyer_id !== user.id ||
    existingPayment.seller_id !== typedOffer.seller_id ||
    existingPayment.listing_id !== typedOffer.listing_id ||
    (existingPayment.conversation_id ?? null) !== (conversation?.id ?? null) ||
    existingPayment.provider !== 'stripe' ||
    existingPayment.currency !== 'EUR' ||
    existingPayment.shipment_tier !== pricing.shipmentTier ||
    existingPayment.metadata?.delivery_method !== pricing.deliveryMethod ||
    !exactCents(existingPayment.amount, pricing.itemAmount) ||
    !exactCents(existingPayment.buyer_fee_amount, pricing.buyerFeeAmount) ||
    !exactCents(existingPayment.shipping_amount, pricing.shippingAmount) ||
    !exactCents(existingPayment.seller_net_amount, pricing.sellerNetAmount)
  )) {
    // Never create a Stripe session or downgrade succeeded/processing payments,
    // even when the historical record has no checkout session metadata.
    throw new Error('Esta operación ya tiene un pago con estado o titular incompatible. Requiere conciliación.')
  }

  const previousSessionId =
    typeof existingPayment?.metadata?.stripe_checkout_session_id === 'string'
      ? existingPayment.metadata.stripe_checkout_session_id
      : null

  if (previousSessionId) {
    let previousSession
    try {
      previousSession = await stripe.checkout.sessions.retrieve(previousSessionId)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      throw new Error(`No se pudo reconciliar la sesión Stripe previa: ${message}`)
    }

    // A saved session ID is not proof of ownership. Stripe is the authority
    // for the invoice and parties, not the metadata in our payment table.
    if (previousSession.metadata?.offer_id !== offerId ||
        previousSession.metadata?.buyer_id !== user.id ||
        previousSession.metadata?.seller_id !== typedOffer.seller_id ||
        previousSession.metadata?.listing_id !== typedOffer.listing_id ||
        previousSession.amount_total !== expectedTotalCents ||
        previousSession.currency !== 'eur') {
      throw new Error('La sesión Stripe previa no coincide con la operación y requiere conciliación.')
    }

    if (previousSession.payment_status === 'paid') {
      throw new Error('Ya existe un pago completado en Stripe para esta oferta. Sincroniza el estado antes de crear otro checkout.')
    }

    if (previousSession.status === 'open') {
      const sameConfiguration =
        existingPayment?.metadata?.delivery_method === pricing.deliveryMethod &&
        existingPayment?.shipment_tier === pricing.shipmentTier &&
        previousSession.amount_total === expectedTotalCents

      if (sameConfiguration && previousSession.client_secret) {
        return {
          clientSecret: previousSession.client_secret,
          sessionId: previousSession.id,
        }
      }

      await stripe.checkout.sessions.expire(previousSession.id)
    }
  }

  let session
  try {
    session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded_page',
      redirect_on_completion: 'never',
      mode: 'payment',
      payment_method_types: ['card'],
      payment_intent_data: {
        transfer_group: `wetudy_${offerId}`,
        metadata: {
          wetudy_offer_id: offerId,
          wetudy_private_preview: 'true',
        },
      },
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
              name: 'Tarifa de servicio · preview',
              description: 'Tarifa provisional para probar el flujo de checkout',
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
    }, {
      idempotencyKey: checkoutIdempotencyKey,
    })
  } catch (stripeError: unknown) {
    const errorMessage = stripeError instanceof Error ? stripeError.message : 'Error desconocido de Stripe'
    throw new Error(`Error al crear sesión de Stripe: ${errorMessage}`)
  }

  // Never persist a checkout or reserve its listing if Stripe's returned
  // invoice differs from the quote, or if the embeddable secret is absent.
  if (!session.id || !session.client_secret ||
      session.amount_total !== expectedTotalCents || session.currency !== 'eur') {
    throw new Error('La sesión Stripe creada no coincide con el importe y requiere conciliación.')
  }

  const now = new Date().toISOString()

  const paymentRow = {
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
  }

  let paymentPersisted = false
  if (existingPayment) {
    // Compare-and-set prevents a webhook's concurrent succeeded transition
    // from being downgraded by a stale checkout attempt.
    const { data: updated, error: paymentWriteError } = await adminSupabase
      .from('payment_intents')
      .update(paymentRow)
      .eq('id', existingPayment.id)
      .eq('offer_id', offerId)
      .eq('buyer_id', user.id)
      .eq('seller_id', typedOffer.seller_id)
      .eq('status', 'requires_payment_method')
      .select('id')
      .maybeSingle()
    paymentPersisted = !paymentWriteError && updated?.id === existingPayment.id
  } else {
    const { data: inserted, error: paymentWriteError } = await adminSupabase
      .from('payment_intents')
      .insert(paymentRow)
      .select('id')
      .single()
    paymentPersisted = !paymentWriteError && Boolean(inserted?.id)
  }

  if (!paymentPersisted) {
    // A Stripe session was already created. Do not retry blindly or report
    // success: a failed/competing DB write requires manual reconciliation.
    throw new Error('Stripe creó la sesión, pero el registro requiere conciliación antes de reintentar.')
  }

  const { error: listingReserveError } = await adminSupabase
    .from('listings')
    .update({ status: 'reserved' })
    .eq('id', typedOffer.listing_id)
    .eq('status', 'available')

  if (listingReserveError) {
    throw new Error(`El pago quedó registrado, pero no se pudo reservar el anuncio: ${listingReserveError.message}`)
  }

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
  const offerId = params?.offerId
  if (typeof offerId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(offerId)) {
    throw new Error('Oferta de pago inválida.')
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error('No se pudo comprobar la sesión.')
  const user = authData?.user
  if (!user) throw new Error('Debes iniciar sesión.')

  if (!(await canUserUseCommerce(user)))
    throw new Error('El checkout privado no está habilitado para esta cuenta.')
  if (!isPublicCommerceEnabled()) assertStripeTestMode()

  const adminSupabase = createAdminClient()
  const { data: paymentIntent, error: paymentLookupError } = await adminSupabase
    .from('payment_intents')
    .select('id, status, offer_id, listing_id, buyer_id, seller_id, currency, provider, amount, buyer_fee_amount, shipping_amount, metadata')
    .eq('offer_id', offerId)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (paymentLookupError) throw new Error('No se pudo comprobar el registro del pago.')
  if (!paymentIntent) throw new Error('No se encontró el intento de pago.')

  // Never accept the provider's "paid" flag without an independently
  // consistent persisted invoice, identity and current payment state.
  const amount = Number(paymentIntent.amount)
  const buyerFee = Number(paymentIntent.buyer_fee_amount)
  const shipping = Number(paymentIntent.shipping_amount)
  const recordedTotal = paymentIntent.metadata?.total_buyer_amount
  const total = typeof recordedTotal === 'number' ? recordedTotal : NaN
  const cents = (value: number) => Math.round(value * 100)
  if (paymentIntent.offer_id !== offerId ||
      paymentIntent.buyer_id !== user.id ||
      typeof paymentIntent.listing_id !== 'string' || !paymentIntent.listing_id ||
      typeof paymentIntent.seller_id !== 'string' || !paymentIntent.seller_id ||
      paymentIntent.provider !== 'stripe' || paymentIntent.currency !== 'EUR' ||
      paymentIntent.metadata?.source !== 'stripe_checkout' ||
      !['requires_payment_method','processing','succeeded'].includes(paymentIntent.status) ||
      ![amount,buyerFee,shipping,total].every(Number.isFinite) ||
      amount <= 0 || buyerFee < 0 || shipping < 0 || total <= 0 ||
      !Number.isSafeInteger(cents(total)) ||
      cents(amount) + cents(buyerFee) + cents(shipping) !== cents(total)) {
    throw new Error('El pago registrado tiene datos incompatibles y requiere conciliación.')
  }
  const sessionId = paymentIntent.metadata?.stripe_checkout_session_id
  if (typeof sessionId !== 'string' || !sessionId)
    throw new Error('No se encontró la sesión Stripe del pago.')

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    throw new Error('No se pudo verificar el pago con Stripe.')
  }
  if (session.id !== sessionId || session.payment_status !== 'paid' ||
      session.status !== 'complete' || session.currency !== 'eur' ||
      session.metadata?.offer_id !== offerId ||
      session.metadata?.buyer_id !== user.id ||
      session.metadata?.seller_id !== paymentIntent.seller_id ||
      session.metadata?.listing_id !== paymentIntent.listing_id ||
      session.amount_total !== cents(total)) {
    throw new Error('La confirmación Stripe no coincide con la operación.')
  }

  // A webhook might have changed the row during Stripe retrieval. Constrain
  // all changes to the originally observed state and verify affected rows.
  // This still is not a cross-table transaction: any partial write requires
  // manual reconciliation and must not be returned as a completed checkout.
  const now = new Date().toISOString()
  const { data: paymentUpdated, error: paymentUpdateError } = await adminSupabase
    .from('payment_intents')
    .update({ status: 'succeeded', updated_at: now })
    .eq('id', paymentIntent.id)
    .eq('buyer_id', user.id)
    .eq('status', paymentIntent.status)
    .select('id').maybeSingle()
  if (paymentUpdateError || paymentUpdated?.id !== paymentIntent.id)
    throw new Error('Pago Stripe aceptado, registro pendiente de conciliación.')

  const { data: offerUpdated, error: offerUpdateError } = await adminSupabase
    .from('listing_offers')
    .update({ status: 'accepted', responded_at: now })
    .eq('id', offerId)
    .eq('buyer_id', user.id)
    .eq('seller_id', paymentIntent.seller_id)
    .eq('status', 'accepted')
    .select('id').maybeSingle()
  if (offerUpdateError || offerUpdated?.id !== offerId)
    throw new Error('Pago Stripe aceptado, oferta pendiente de conciliación.')

  const { data: listingUpdated, error: listingUpdateError } = await adminSupabase
    .from('listings')
    .update({ status: 'sold' })
    .eq('id', paymentIntent.listing_id)
    .eq('seller_id', paymentIntent.seller_id)
    .in('status', ['reserved','sold'])
    .select('id').maybeSingle()
  if (listingUpdateError || listingUpdated?.id !== paymentIntent.listing_id)
    throw new Error('Pago Stripe aceptado, anuncio pendiente de conciliación.')

  return { success: true }
}

/**
 * Verifica el estado de una sesión de Stripe Checkout.
 */
export async function checkSessionStatus(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Debes iniciar sesión.')
  }

  if (!(await canUserUseCommerce(user))) {
    throw new Error('El checkout privado no está habilitado para esta cuenta.')
  }
  if (!isPublicCommerceEnabled()) assertStripeTestMode()

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
