import "server-only";

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

  if (!secret) throw new Error("Stripe test no está configurado.");

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

  const payload: any = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.message ||
        `Stripe v2 respondió ${response.status}.`
    );
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
      identity: { country: "ES" },
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: { requested: true },
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
          collection_options: { fields: "eventually_due" },
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

  return {
    providerAccountId: accountId,
    onboardingStatus: transfersEnabled
      ? "ready"
      : disabledReason
        ? "restricted"
        : "onboarding",
    transfersEnabled,
    requirementsDue: readRequirementLabels(account?.requirements),
    disabledReason,
  };
}
