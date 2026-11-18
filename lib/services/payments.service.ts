import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildMarketplacePricing,
  isDeliveryMethod,
  isShipmentTier,
  type DeliveryMethod,
  type ShipmentTier,
} from "@/lib/payments/pricing";

export function normalizeCheckoutSelection(input: {
  deliveryMethod?: unknown;
  shipmentTier?: unknown;
}) {
  if (input.deliveryMethod !== undefined && !isDeliveryMethod(input.deliveryMethod))
    throw new Error("Método de entrega inválido.");
  if (input.shipmentTier !== undefined && !isShipmentTier(input.shipmentTier))
    throw new Error("Tamaño de envío inválido.");
  const deliveryMethod: DeliveryMethod = input.deliveryMethod === undefined
    ? "shipping" : input.deliveryMethod as DeliveryMethod;
  const shipmentTier: ShipmentTier = input.shipmentTier === undefined
    ? (deliveryMethod === "shipping" ? "small" : "none")
    : input.shipmentTier as ShipmentTier;
  if (deliveryMethod === "shipping" && shipmentTier === "none")
    throw new Error("El envío requiere un tamaño con portes.");

  if (deliveryMethod === "in_person") {
    return { deliveryMethod, shipmentTier: "none" as const };
  }

  return { deliveryMethod, shipmentTier };
}

export async function getAcceptedOfferForBuyer(params: {
  supabase: SupabaseClient;
  offerId: string;
  buyerId: string;
}) {
  const { supabase, offerId, buyerId } = params;

  const { data: offer, error } = await supabase
    .from("listing_offers")
    .select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, accepted_amount, status")
    .eq("id", offerId)
    .maybeSingle();

  if (error || !offer) {
    throw new Error(error?.message || "Oferta no encontrada.");
  }

  if (offer.buyer_id !== buyerId) {
    throw new Error("No puedes consultar esta operación.");
  }

  if (offer.status !== "accepted") {
    throw new Error("La oferta aún no está aceptada.");
  }

  const itemAmount = Number(offer.accepted_amount ?? offer.current_amount ?? offer.offered_price ?? 0);
  if (!Number.isFinite(itemAmount) || itemAmount <= 0) {
    throw new Error("El importe de la operación no es válido.");
  }

  return {
    offer,
    itemAmount,
  };
}

export async function buildPaymentQuote(params: {
  supabase: SupabaseClient;
  offerId: string;
  buyerId: string;
  deliveryMethod?: unknown;
  shipmentTier?: unknown;
}) {
  const { supabase, offerId, buyerId, deliveryMethod, shipmentTier } = params;
  const selection = normalizeCheckoutSelection({ deliveryMethod, shipmentTier });
  const acceptedOffer = await getAcceptedOfferForBuyer({ supabase, offerId, buyerId });

  return {
    offer: acceptedOffer.offer,
    quote: buildMarketplacePricing({
      itemAmount: acceptedOffer.itemAmount,
      deliveryMethod: selection.deliveryMethod,
      shipmentTier: selection.shipmentTier,
    }),
  };
}

export async function createPaymentIntentDraft(params: {
  supabase: SupabaseClient;
  offerId: string;
  buyerId: string;
  deliveryMethod?: unknown;
  shipmentTier?: unknown;
}) {
  const { supabase, offerId, buyerId, deliveryMethod, shipmentTier } = params;
  const { offer, quote } = await buildPaymentQuote({
    supabase,
    offerId,
    buyerId,
    deliveryMethod,
    shipmentTier,
  });

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", offer.listing_id)
    .eq("buyer_id", offer.buyer_id)
    .eq("seller_id", offer.seller_id)
    .maybeSingle();

  if (conversationError) {
    throw new Error(conversationError.message || "No se pudo consultar la conversación.");
  }

  const now = new Date().toISOString();
  const paymentStatus = "requires_payment_method";

  const columns = "id,status,amount,currency,provider,offer_id,listing_id,conversation_id,buyer_id,seller_id,buyer_fee_amount,shipping_amount,seller_net_amount,platform_fee_amount,shipment_tier,metadata";
  const { data: previous, error: readError } = await supabase
    .from("payment_intents").select(columns).eq("offer_id", offer.id).maybeSingle();
  if (readError) throw new Error("No se pudo comprobar el pago existente.");

  const centsEqual = (actual: unknown, expected: number) =>
    actual !== null && actual !== undefined && Number.isFinite(Number(actual)) &&
    Math.round(Number(actual) * 100) === Math.round(expected * 100);
  const compatible = (item: any) =>
    typeof item?.id === "string" && item.id.length > 0 &&
    item.status === "requires_payment_method" && item.provider === "stripe" &&
    item.offer_id === offer.id && item.listing_id === offer.listing_id &&
    item.buyer_id === offer.buyer_id && item.seller_id === offer.seller_id &&
    (item.conversation_id ?? null) === (conversation?.id ?? null) &&
    item.currency === "EUR" && item.shipment_tier === quote.shipmentTier &&
    item.metadata?.source === "offer_acceptance" &&
    item.metadata?.delivery_method === quote.deliveryMethod &&
    centsEqual(item.amount, quote.itemAmount) &&
    centsEqual(item.buyer_fee_amount, quote.buyerFeeAmount) &&
    centsEqual(item.shipping_amount, quote.shippingAmount) &&
    centsEqual(item.seller_net_amount, quote.sellerNetAmount) &&
    centsEqual(item.platform_fee_amount, quote.buyerFeeAmount);

  let paymentIntent: any;
  if (previous) {
    if (!compatible(previous))
      throw new Error("Ya existe un pago con otro estado o condiciones; requiere conciliación.");
    paymentIntent = previous; // read-only retry, never downgrade an already paid row
  } else {
    const { data: created, error: insertError } = await supabase
      .from("payment_intents")
      .insert({
        listing_id: offer.listing_id,
        conversation_id: conversation?.id || null,
        offer_id: offer.id,
        buyer_id: offer.buyer_id,
        seller_id: offer.seller_id,
        amount: quote.itemAmount,
        currency: "EUR",
        provider: "stripe",
        status: paymentStatus,
        buyer_fee_amount: quote.buyerFeeAmount,
        shipping_amount: quote.shippingAmount,
        seller_net_amount: quote.sellerNetAmount,
        platform_fee_amount: quote.buyerFeeAmount,
        shipment_tier: quote.shipmentTier,
        metadata: {
          source: "offer_acceptance",
          delivery_method: quote.deliveryMethod,
          total_buyer_amount: quote.totalBuyerAmount,
        },
        updated_at: now,
      })
      .select(columns).single();
    if (insertError?.code === "23505")
      throw new Error("Ya existe un pago concurrente; comprueba su estado antes de repetir.");
    if (insertError || !created) throw new Error("No se pudo preparar el pago.");
    if (!compatible(created))
      throw new Error("El pago se creó, pero requiere conciliación antes de continuar.");
    paymentIntent = created;
  }

  return { paymentIntent, quote };
}
