/**
 * Dormant adapter for the explicitly applied Education Marketplace atomic
 * buy-now RPC (20261119081526). Not called by any route: integration needs
 * authenticated buyer/school authorization and end-to-end two-school tests.
 *
 * This function only prepares PostgreSQL records; it never charges Stripe.
 */
type RpcResponse = { data: unknown; error: unknown };
export type PrivilegedRpc = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResponse>;
};

export type AtomicBuyNowQuote = {
  itemAmount: number;
  buyerFeeAmount: number;
  shippingAmount: number;
  totalBuyerAmount: number;
  deliveryMethod: "shipping" | "in_person";
  shipmentTier: "none" | "small" | "medium" | "large";
};

type PreparedBuyNow = {
  listing_id: string;
  conversation_id: string;
  offer_id: string;
  event_id: string;
  payment_intent_id: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money = (n: number) => Number.isFinite(n) &&
  n >= 0 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-7;

export async function prepareAtomicBuyNowDatabaseOnly({
  admin, listingId, buyerId, sellerId, quote,
}: {
  admin: PrivilegedRpc;
  listingId: string;
  buyerId: string;
  sellerId: string;
  quote: AtomicBuyNowQuote;
}): Promise<PreparedBuyNow> {
  if (!UUID.test(listingId) || !UUID.test(buyerId) ||
      !UUID.test(sellerId) || buyerId === sellerId ||
      !quote || !money(quote.itemAmount) || quote.itemAmount <= 0 ||
      !money(quote.buyerFeeAmount) || !money(quote.shippingAmount) ||
      !money(quote.totalBuyerAmount) ||
      quote.totalBuyerAmount > 1_000_000 ||
      Math.round(quote.totalBuyerAmount * 100) !==
        Math.round(quote.itemAmount * 100) + Math.round(quote.buyerFeeAmount * 100) +
        Math.round(quote.shippingAmount * 100) ||
      !["shipping", "in_person"].includes(quote.deliveryMethod) ||
      !["none", "small", "medium", "large"].includes(quote.shipmentTier) ||
      (quote.deliveryMethod === "shipping" &&
        (quote.shipmentTier === "none" || quote.shippingAmount <= 0)) ||
      (quote.deliveryMethod === "in_person" &&
        (quote.shipmentTier !== "none" || quote.shippingAmount !== 0))) {
    throw new Error("Parámetros de compra atómica inválidos.");
  }
  // The caller MUST be an already authorized server-side service-role client.
  // Never accept a token, actor or prices directly from untrusted UI input.
  let data: unknown, error: unknown;
  try {
    ({ data, error } = await admin.rpc("p0_buy_now_prepare_atomic_candidate", {
      p_listing_id: listingId,
      p_buyer_id: buyerId,
      p_seller_id: sellerId,
      p_expected_price: quote.itemAmount,
      p_delivery_method: quote.deliveryMethod,
      p_shipment_tier: quote.shipmentTier,
      p_buyer_fee: quote.buyerFeeAmount,
      p_shipping_amount: quote.shippingAmount,
      p_total_amount: quote.totalBuyerAmount,
    }));
  } catch {
    throw new Error("Resultado de preparación atómica desconocido; requiere conciliación.");
  }
  if (error) throw new Error("Preparación atómica no confirmada; requiere conciliación.");
  const result = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
  if (!result || typeof result !== "object" ||
      (result as any).listing_id !== listingId ||
      !["conversation_id", "offer_id", "event_id", "payment_intent_id"]
        .every((key) => UUID.test((result as any)[key]))) {
    // A committed RPC can fail to transmit its response. Never retry blindly.
    throw new Error("Compra preparada sin confirmación fiable; requiere conciliación.");
  }
  return result as PreparedBuyNow;
}
