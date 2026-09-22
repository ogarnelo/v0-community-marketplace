import "server-only";

import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type StripeConnectAccount = {
  id: string;
  type?: string | null;
  country?: string | null;
  default_currency?: string | null;
  business_type?: string | null;
  details_submitted?: boolean | null;
  payouts_enabled?: boolean | null;
  charges_enabled?: boolean | null;
  capabilities?: { transfers?: string | null } | null;
  requirements?: {
    currently_due?: string[] | null;
    eventually_due?: string[] | null;
    disabled_reason?: string | null;
  } | null;
};

function getAccountsApi() {
  const accounts = (stripe as any).accounts;
  if (!accounts?.create || !accounts?.retrieve) {
    throw new Error("La versión instalada de Stripe no expone Connected Accounts.");
  }
  return accounts as {
    create: (params: Record<string, unknown>, options?: Record<string, unknown>) => Promise<StripeConnectAccount>;
    retrieve: (id: string) => Promise<StripeConnectAccount>;
  };
}

export function connectStatusFromAccount(account: StripeConnectAccount) {
  const currentlyDue = account.requirements?.currently_due || [];
  const eventuallyDue = account.requirements?.eventually_due || [];
  const transfersActive = account.capabilities?.transfers === "active";
  const disabledReason = account.requirements?.disabled_reason || null;
  const ready =
    Boolean(account.details_submitted) &&
    Boolean(account.payouts_enabled) &&
    transfersActive &&
    currentlyDue.length === 0;

  return {
    onboardingStatus: disabledReason
      ? "disabled"
      : ready
        ? "ready"
        : account.details_submitted
          ? "restricted"
          : "pending",
    detailsSubmitted: Boolean(account.details_submitted),
    payoutsEnabled: Boolean(account.payouts_enabled),
    chargesEnabled: Boolean(account.charges_enabled),
    transfersActive,
    currentlyDue,
    eventuallyDue,
    disabledReason,
  };
}

export async function syncSellerConnectAccountSnapshot(params: {
  userId: string;
  account: StripeConnectAccount;
}) {
  const { account } = params;
  const status = connectStatusFromAccount(account);
  const admin = createAdminClient();

  const { error } = await admin.from("seller_connect_accounts").upsert(
    {
      user_id: params.userId,
      stripe_account_id: account.id,
      account_type: account.type || "express",
      onboarding_status: status.onboardingStatus,
      details_submitted: status.detailsSubmitted,
      payouts_enabled: status.payoutsEnabled,
      charges_enabled: status.chargesEnabled,
      transfers_active: status.transfersActive,
      requirements_currently_due: status.currentlyDue,
      requirements_eventually_due: status.eventuallyDue,
      metadata: {
        country: account.country || null,
        default_currency: account.default_currency || null,
        business_type: account.business_type || null,
        disabled_reason: status.disabledReason,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
  return { account, status };
}

export async function syncSellerConnectAccount(params: {
  userId: string;
  stripeAccountId: string;
}) {
  const account = await getAccountsApi().retrieve(params.stripeAccountId);
  return syncSellerConnectAccountSnapshot({
    userId: params.userId,
    account,
  });
}

export async function ensureSellerConnectAccount(params: {
  userId: string;
  email?: string | null;
}) {
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("seller_connect_accounts")
    .select("stripe_account_id")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing?.stripe_account_id) {
    return syncSellerConnectAccount({
      userId: params.userId,
      stripeAccountId: existing.stripe_account_id,
    });
  }

  const account = await getAccountsApi().create(
    {
      type: "express",
      country: "ES",
      email: params.email || undefined,
      capabilities: {
        transfers: { requested: true },
      },
      business_profile: {
        product_description:
          "Reutilización de material escolar entre usuarios de Wetudy",
      },
      metadata: {
        wetudy_user_id: params.userId,
        wetudy_private_preview: "true",
      },
    },
    {
      idempotencyKey: `wetudy-connect-account-v1:${params.userId}`,
    }
  );

  const status = connectStatusFromAccount(account);
  const { error: insertError } = await admin
    .from("seller_connect_accounts")
    .insert({
      user_id: params.userId,
      stripe_account_id: account.id,
      account_type: account.type || "express",
      onboarding_status: status.onboardingStatus,
      details_submitted: status.detailsSubmitted,
      payouts_enabled: status.payoutsEnabled,
      charges_enabled: status.chargesEnabled,
      transfers_active: status.transfersActive,
      requirements_currently_due: status.currentlyDue,
      requirements_eventually_due: status.eventuallyDue,
      metadata: {
        country: account.country || null,
        default_currency: account.default_currency || null,
        business_type: account.business_type || null,
        disabled_reason: status.disabledReason,
      },
    });

  if (insertError && insertError.code !== "23505") throw insertError;

  if (insertError?.code === "23505") {
    const { data: raced } = await admin
      .from("seller_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", params.userId)
      .single();

    if (raced?.stripe_account_id && raced.stripe_account_id !== account.id) {
      return syncSellerConnectAccount({
        userId: params.userId,
        stripeAccountId: raced.stripe_account_id,
      });
    }
  }

  return { account, status };
}
