export type DeliveryMethod = "in_person" | "shipping";
export type ShipmentTier = "none" | "small" | "medium" | "large";

const BUYER_PROTECTION_FIXED = 0.7;
const BUYER_PROTECTION_RATE = 0.05;

const SHIPPING_PRICES: Record<Exclude<ShipmentTier, "none">, number> = {
  small: 2.99,
  medium: 4.49,
  large: 6.99,
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function getShippingAmount(tier: ShipmentTier) {
  if (tier === "none") return 0;
  return SHIPPING_PRICES[tier];
}

export function buildMarketplacePricing(params: {
  itemAmount: number;
  deliveryMethod?: DeliveryMethod;
  shipmentTier?: ShipmentTier;
}) {
  const itemAmount = roundCurrency(params.itemAmount);
  const deliveryMethod = params.deliveryMethod ?? "shipping";
  const shipmentTier = deliveryMethod === "shipping" ? params.shipmentTier ?? "small" : "none";

  const buyerFeeAmount =
    deliveryMethod === "shipping"
      ? roundCurrency(itemAmount * BUYER_PROTECTION_RATE + BUYER_PROTECTION_FIXED)
      : 0;

  const shippingAmount =
    deliveryMethod === "shipping" ? getShippingAmount(shipmentTier) : 0;

  const totalBuyerAmount = roundCurrency(itemAmount + buyerFeeAmount + shippingAmount);

  return {
    itemAmount,
    deliveryMethod,
    buyerFeeAmount,
    shippingAmount,
    shipmentTier,
    sellerNetAmount: itemAmount,
    totalBuyerAmount,
  };
}
