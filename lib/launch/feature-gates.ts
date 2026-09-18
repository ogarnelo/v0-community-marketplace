export function isLegacyCommerceEnabled() {
  return process.env.ENABLE_LEGACY_COMMERCE === "true"
}

export function isPaymentShippingSandboxEnabled() {
  return process.env.ENABLE_PAYMENT_SHIPPING_SANDBOX === "true"
}
