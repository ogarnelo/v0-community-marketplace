import "server-only";

import { stripe } from "@/lib/stripe";

export async function resolveStripePaymentIntentAndCharge(params: {
  providerPaymentIntentId?: string | null;
  checkoutSessionId?: string | null;
}) {
  let providerPaymentIntentId = params.providerPaymentIntentId || null;

  if (!providerPaymentIntentId && params.checkoutSessionId) {
    const session = await stripe.checkout.sessions.retrieve(params.checkoutSessionId);
    providerPaymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null;
  }

  if (!providerPaymentIntentId) {
    throw new Error("No se encontró el PaymentIntent de Stripe.");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(
    providerPaymentIntentId
  );

  const latestCharge =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id || null;

  if (!latestCharge) {
    throw new Error("El pago no tiene un cargo Stripe asociado.");
  }

  return {
    providerPaymentIntentId,
    chargeId: latestCharge,
    paymentIntent,
  };
}
