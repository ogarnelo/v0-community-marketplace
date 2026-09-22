import "server-only";

import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { assertStripeTestMode } from "@/lib/commerce/private-access";

const STRIPE_V2_VERSION = "2026-07-29.preview";
const STRIPE_V2_BASE = "https://api.stripe.com/v2/core";

export type ConnectedAccountSnapshot = {
  providerAccountId: string;
  onboardingStatus: "created" | "onboarding" | "ready" | "restricted";
  transfersEnabled: boolean;
  requirementsDue: string[];
  disabledReason: string | null;
};

async function stripeV2Fetch<T>(path: string, init?: RequestInit): Promise<T> {
  assertStripeTestMode();
  const secret = process.env.STRIPE_SECRET_KEY;

  if (!secret) {
    throw new Error("Stripe test no está configurado.");
  }

  const response = await fetch(`${STRIPE_V2_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Stripe-Version": STRIPE_V2_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Stripe v2 respondió ${response.status}.`;
    throw new Error(message);
  }

  return payload as T;
}

export async function createStripeRecipientAccount(params: {
  email: string;
  displayName?: string | null;
}) {
  return stripeV2Fetch<{ id: string }>("/accounts", {
    method: "POST",
    body: JSON.stringify({
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
      include: ["configuration.recipient", "identity", "requirements"],
    }),
  });
}

export async function createStripeRecipientOnboardingLink(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  return stripeV2Fetch<{ url: string }>("/account_links", {
    method: "POST",
    body: JSON.stringify({
      account: params.accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          collection_options: {
            fields: "eventually_due",
          },
          refresh_url: params.refreshUrl,
          return_url: params.returnUrl,
        },
      },
    }),
  });
}

function readRequirementLabels(requirements: any): string[] {
  const entries = Array.isArray(requirements)
    ? requirements
    : Array.isArray(requirements?.data)
      ? requirements.data
      : Array.isArray(requirements?.entries)
        ? requirements.entries
        : [];

  return Array.from(
    new Set(
      entries
        .map((entry: any) =>
          [
            entry?.reference,
            entry?.field,
            entry?.type,
            entry?.requested_reasons?.[0]?.code,
          ].find((value) => typeof value === "string" && value.trim())
        )
        .filter(Boolean)
    )
  ) as string[];
}

export async function getConnectedAccountSnapshot(
  accountId: string
): Promise<ConnectedAccountSnapshot> {
  const query = new URLSearchParams();
  query.append("include[0]", "configuration.recipient");
  query.append("include[1]", "requirements");

  const account = await stripeV2Fetch<any>(
    `/accounts/${encodeURIComponent(accountId)}?${query.toString()}`
  );

  const capability =
    account?.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers || null;
  const transfersEnabled = capability?.status === "active";
  const statusDetails = Array.isArray(capability?.status_details)
    ? capability.status_details
    : [];
  const disabledReason =
    statusDetails
      .map((detail: any) => detail?.code)
      .find((value: unknown) => typeof value === "string") || null;
  const requirementsDue = readRequirementLabels(account?.requirements);

  return {
    providerAccountId: accountId,
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
