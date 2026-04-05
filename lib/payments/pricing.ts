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
  shipmentTier?: ShipmentTier;
}) {
  const itemAmount = roundCurrency(params.itemAmount);
  const shipmentTier = params.shipmentTier ?? "none";
  const buyerFeeAmount = roundCurrency(itemAmount * BUYER_PROTECTION_RATE + BUYER_PROTECTION_FIXED);
  const shippingAmount = getShippingAmount(shipmentTier);
  const totalBuyerAmount = roundCurrency(itemAmount + buyerFeeAmount + shippingAmount);

  return {
    itemAmount,
    buyerFeeAmount,
    shippingAmount,
    shipmentTier,
    sellerNetAmount: itemAmount,
    totalBuyerAmount,
  };
}
