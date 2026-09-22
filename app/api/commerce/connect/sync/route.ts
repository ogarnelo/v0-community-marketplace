import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertStripeTestMode,
  canUserAccessPrivateCommercePreview,
} from "@/lib/commerce/private-access";
import { getConnectedAccountSnapshot } from "@/lib/commerce/stripe-connect";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await canUserAccessPrivateCommercePreview(user))) {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }

  try {
    assertStripeTestMode();
    const admin = createAdminClient();
    const accountResult = await admin
      .from("commerce_connected_accounts")
      .select("provider_account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const account = accountResult.data as { provider_account_id: string } | null;

    if (!account?.provider_account_id) {
      return NextResponse.json({ error: "No hay cuenta Connect." }, { status: 404 });
    }

    const snapshot = await getConnectedAccountSnapshot(account.provider_account_id);
    const { data: updated, error } = await admin
      .from("commerce_connected_accounts")
      .update({
        onboarding_status: snapshot.onboardingStatus,
        transfers_enabled: snapshot.transfersEnabled,
        requirements_due: snapshot.requirementsDue,
        disabled_reason: snapshot.disabledReason,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select("user_id, provider_account_id, onboarding_status, transfers_enabled, requirements_due, disabled_reason, updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, account: updated });
  } catch (error: any) {
    console.error("Error sincronizando Stripe Connect", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo sincronizar Stripe Connect." },
      { status: 500 }
    );
  }
}
