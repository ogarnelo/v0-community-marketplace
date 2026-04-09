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
  const deliveryMethod: DeliveryMethod = isDeliveryMethod(input.deliveryMethod)
    ? input.deliveryMethod
    : "shipping";

  const shipmentTier: ShipmentTier = isShipmentTier(input.shipmentTier)
    ? input.shipmentTier
    : deliveryMethod === "shipping"
      ? "small"
      : "none";

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
  const acceptedOffer = await getAcceptedOfferForBuyer({ supabase, offerId, buyerId });
  const selection = normalizeCheckoutSelection({ deliveryMethod, shipmentTier });

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
  const paymentStatus = quote.deliveryMethod === "shipping" ? "requires_shipping_quote" : "requires_payment_method";

  const { data: paymentIntent, error } = await supabase
    .from("payment_intents")
    .upsert(
      {
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
      },
      { onConflict: "offer_id" }
    )
    .select("id, status, amount, currency, buyer_fee_amount, shipping_amount, seller_net_amount, platform_fee_amount, shipment_tier, metadata")
    .single();

  if (error || !paymentIntent) {
    throw new Error(error?.message || "No se pudo preparar el pago.");
  }

  return {
    paymentIntent,
    quote,
  };
}
