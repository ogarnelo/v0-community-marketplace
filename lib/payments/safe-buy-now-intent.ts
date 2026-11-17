import type { SupabaseClient } from "@supabase/supabase-js";

export class BuyNowPaymentError extends Error {
  constructor(public readonly status: 409 | 503, public readonly publicMessage: string) {
    super(publicMessage);
    this.name = "BuyNowPaymentError";
  }
}
type Pricing = {
  itemAmount: number; totalBuyerAmount: number; buyerFeeAmount: number;
  shippingAmount: number; sellerNetAmount: number; shipmentTier: string;
};
type Listing = {id: string; seller_id: string; school_id?: string | null};
export async function prepareBuyNowPaymentIntent(params: {
  admin: SupabaseClient; listing: Listing; userId: string;
  offerId: string; conversationId: string | null;
  pricing: Pricing; deliveryMethod: string; now: string;
}) {
  const {admin, listing, userId, offerId, conversationId, pricing, deliveryMethod, now} = params;
  const columns = "id,amount,currency,status,provider,offer_id,listing_id,buyer_id,seller_id,school_id,buyer_fee_amount,shipping_amount,seller_net_amount,shipment_tier,metadata";
  const { data: previous, error: previousError } = await admin.from("payment_intents")
    .select(columns).eq("offer_id", offerId).maybeSingle();
  if (previousError) throw new BuyNowPaymentError(503, "No se pudo verificar el intento de pago.");

  const sameCents = (a: unknown, b: number) =>
    a !== null && a !== undefined && Number.isFinite(Number(a)) &&
    Math.round(Number(a)*100) === Math.round(b*100);
  const compatible = (i: any) =>
    i?.status === "requires_payment_method" && i.provider === "stripe" &&
    i.offer_id === offerId && i.listing_id === listing.id &&
    i.buyer_id === userId && i.seller_id === listing.seller_id &&
    (i.school_id || null) === (listing.school_id || null) &&
    i.currency === "EUR" && i.shipment_tier === pricing.shipmentTier &&
    i.metadata?.source === "buy_now" && i.metadata?.delivery_method === deliveryMethod &&
    sameCents(i.metadata?.item_amount,pricing.itemAmount) &&
    sameCents(i.amount,pricing.totalBuyerAmount) &&
    sameCents(i.buyer_fee_amount,pricing.buyerFeeAmount) &&
    sameCents(i.shipping_amount,pricing.shippingAmount) &&
    sameCents(i.seller_net_amount,pricing.sellerNetAmount);

  let result: any;
  if (previous) {
    if (!compatible(previous)) {
      throw new BuyNowPaymentError(409, "Este pago ya existe con otro estado o condiciones. No puede reiniciarse.");
    }
    result=previous; // Repeatable read-only: never reset a charged payment.
  } else {
    const {data: created,error: createError} = await admin.from("payment_intents")
      .insert({
        listing_id: listing.id, conversation_id: conversationId, offer_id: offerId,
        buyer_id: userId, seller_id: listing.seller_id,
        school_id: listing.school_id || null, amount: pricing.totalBuyerAmount,
        currency: "EUR", provider: "stripe", status: "requires_payment_method",
        buyer_fee_amount: pricing.buyerFeeAmount, shipping_amount: pricing.shippingAmount,
        seller_net_amount: pricing.sellerNetAmount, shipment_tier: pricing.shipmentTier,
        metadata: {source:"buy_now", delivery_method:deliveryMethod, item_amount:pricing.itemAmount},
        updated_at: now,
      }).select(columns).single();
    if(createError?.code==="23505") {
      throw new BuyNowPaymentError(409, "Otro intento de pago ya se ha preparado. Consulta su estado antes de reintentar.");
    }
    if(createError || !created) throw new BuyNowPaymentError(503, "No se pudo preparar el checkout.");
    result=created;
  }
  return { id: result.id, amount: result.amount, currency: result.currency, status: result.status };
}
