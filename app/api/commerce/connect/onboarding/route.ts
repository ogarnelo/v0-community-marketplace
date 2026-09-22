import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertStripeTestMode,
  canUserAccessPrivateCommercePreview,
} from "@/lib/commerce/private-access";
import {
  createStripeRecipientAccount,
  createStripeRecipientOnboardingLink,
} from "@/lib/commerce/stripe-connect";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await canUserAccessPrivateCommercePreview(user))) {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }

  if (!user.email) {
    return NextResponse.json(
      { error: "La cuenta necesita un email para iniciar onboarding." },
      { status: 400 }
    );
  }

  try {
    assertStripeTestMode();
    const admin = createAdminClient();

    const [{ data: existing }, { data: profile }] = await Promise.all([
      admin
        .from("commerce_connected_accounts")
        .select("user_id, provider_account_id, onboarding_status")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    let accountId = existing?.provider_account_id || null;

    if (!accountId) {
      const account = await createStripeRecipientAccount({
        email: user.email,
        displayName: profile?.full_name || user.email,
      });
      accountId = account.id;

      const { error: insertError } = await admin
        .from("commerce_connected_accounts")
        .insert({
          user_id: user.id,
          provider: "stripe",
          provider_account_id: account.id,
          api_namespace: "v2",
          configuration: "recipient",
          onboarding_status: "created",
          transfers_enabled: false,
          requirements_due: [],
          updated_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;
    }

    const origin = new URL(request.url).origin;
    const link = await createStripeRecipientOnboardingLink({
      accountId,
      refreshUrl: `${origin}/api/commerce/connect/refresh`,
      returnUrl: `${origin}/account/commerce?connect=returned`,
    });

    await admin
      .from("commerce_connected_accounts")
      .update({
        onboarding_status: "onboarding",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true, url: link.url });
  } catch (error: any) {
    console.error("Error iniciando onboarding Stripe Connect", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo iniciar Stripe Connect." },
      { status: 500 }
    );
  }
}
