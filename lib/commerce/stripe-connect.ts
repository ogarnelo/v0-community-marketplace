import "server-only";

import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { assertStripeTestMode } from "@/lib/commerce/private-access";

export type ConnectedAccountSnapshot = {
  providerAccountId: string;
  onboardingStatus: "created" | "onboarding" | "ready" | "restricted";
  transfersEnabled: boolean;
  requirementsDue: string[];
  disabledReason: string | null;
};

export async function createStripeRecipientAccount(params: {
  email: string;
  displayName?: string | null;
}) {
  assertStripeTestMode();

  const account = await stripe.v2.core.accounts.create({
    display_name: params.displayName?.trim() || params.email,
    contact_email: params.email,
    dashboard: "express",
    defaults: {
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
    },
    identity: {
      country: "ES",
      entity_type: "individual",
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: {
              requested: true,
            },
          },
        },
      },
    },
    include: ["configuration.recipient", "requirements"],
  });

  return account;
}

export async function createStripeRecipientOnboardingLink(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  assertStripeTestMode();

  return stripe.v2.core.accountLinks.create({
    account: params.accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["recipient"],
        refresh_url: params.refreshUrl,
        return_url: params.returnUrl,
      },
    },
  });
}

export async function getConnectedAccountSnapshot(
  accountId: string
): Promise<ConnectedAccountSnapshot> {
  assertStripeTestMode();

  // Accounts v2 IDs are compatible with the v1 retrieve endpoint. The v1
  // shape exposes the legacy "transfers" capability, which maps to the v2
  // recipient stripe_balance.stripe_transfers capability.
  const account = await stripe.accounts.retrieve(accountId);
  const requirements = "requirements" in account ? account.requirements : null;
  const transfersCapability =
    "capabilities" in account ? account.capabilities?.transfers : undefined;
  const transfersEnabled = transfersCapability === "active";
  const disabledReason = requirements?.disabled_reason || null;
  const requirementsDue = Array.from(
    new Set([
      ...(requirements?.currently_due || []),
      ...(requirements?.past_due || []),
    ])
  );

  return {
    providerAccountId: account.id,
    onboardingStatus: transfersEnabled
      ? "ready"
      : disabledReason
        ? "restricted"
        : "onboarding",
    transfersEnabled,
    requirementsDue,
    disabledReason,
  };
}

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

  if (!paymentIntent) {
    throw new Error("No se encontró el PaymentIntent de Stripe.");
  }

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
    {
      idempotencyKey: `wetudy-transfer-v1:${params.paymentId}`,
    }
  );
}
