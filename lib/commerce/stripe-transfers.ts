import "server-only";

import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { assertStripeTestMode } from "@/lib/commerce/private-access";

export async function createDelayedSellerTransfer(params: {
  paymentId: string;
  checkoutSessionId: string;
  sellerAccountId: string;
  amountCents: number;
  currency: string;
  sellerId: string;
}) {
  assertStripeTestMode();

  const session = await stripe.checkout.sessions.retrieve(
    params.checkoutSessionId,
    { expand: ["payment_intent.latest_charge"] }
  );

  if (session.payment_status !== "paid") {
    throw new Error("Stripe no confirma el pago como paid.");
  }

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? await stripe.paymentIntents.retrieve(session.payment_intent, {
          expand: ["latest_charge"],
        })
      : (session.payment_intent as Stripe.PaymentIntent | null);

  if (!paymentIntent) throw new Error("No se encontró el PaymentIntent de Stripe.");

  const chargeId =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id || null;

  if (!chargeId) {
    throw new Error("El pago todavía no tiene un cargo transferible.");
  }

  return stripe.transfers.create(
    {
      amount: params.amountCents,
      currency: params.currency.toLowerCase(),
      destination: params.sellerAccountId,
      source_transaction: chargeId,
      transfer_group: `wetudy_${params.paymentId}`,
      metadata: {
        wetudy_payment_id: params.paymentId,
        wetudy_seller_id: params.sellerId,
        private_preview: "true",
      },
    },
    { idempotencyKey: `wetudy-transfer-v1:${params.paymentId}` }
  );
}
