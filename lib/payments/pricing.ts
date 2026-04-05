export type ShipmentTier = "small" | "medium" | "large";

const SHIPPING_BY_TIER: Record<ShipmentTier, number> = {
  small: 2.95,
  medium: 4.5,
  large: 6.95,
};

export function buildBuyerPricing(params: { itemAmount: number; shipmentTier?: string }) {
  const itemAmount = Math.max(0, Number(params.itemAmount || 0));
  const normalizedTier: ShipmentTier = params.shipmentTier === "small" || params.shipmentTier === "large" ? params.shipmentTier : "medium";
  const shippingAmount = SHIPPING_BY_TIER[normalizedTier];

  // Modelo tipo Vinted adaptado: el comprador asume protección + envío.
  const buyerFeeAmount = Number((Math.max(0.3, itemAmount * 0.05) + 0.3).toFixed(2));
  // Comisión baja de lanzamiento soportada por plataforma sobre la operación.
  const sellerCommissionAmount = Number((itemAmount * 0.02).toFixed(2));
  const sellerNetAmount = Number((itemAmount - sellerCommissionAmount).toFixed(2));
  const totalBuyerAmount = Number((itemAmount + buyerFeeAmount + shippingAmount).toFixed(2));

  return {
    itemAmount,
    buyerFeeAmount,
    sellerCommissionAmount,
    sellerNetAmount,
    shippingAmount,
    totalBuyerAmount,
    shipmentTier: normalizedTier,
  };
}
