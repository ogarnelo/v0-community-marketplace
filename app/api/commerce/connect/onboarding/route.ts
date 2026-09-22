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
} from "@/lib/commerce/stripe-connect-v2";

type ConnectedAccountRow = {
  provider_account_id: string;
};

type ProfileRow = {
  full_name: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const authResult = await supabase.auth.getUser();
  const user = authResult.data.user;

  if (!user || !(await canUserAccessPrivateCommercePreview(user))) {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }

  const email = user.email?.trim();
  if (!email) {
    return NextResponse.json(
      { error: "La cuenta necesita un email para iniciar onboarding." },
      { status: 400 }
    );
  }

  try {
    assertStripeTestMode();
    const admin = createAdminClient();

    const existingResult = await admin
      .from("commerce_connected_accounts")
      .select("provider_account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const existing = (existingResult.data as ConnectedAccountRow | null) ?? null;

    const profileResult = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const profile = (profileResult.data as ProfileRow | null) ?? null;

    let accountId = existing?.provider_account_id || "";

    if (!accountId) {
      const account = await createStripeRecipientAccount({
        email,
        displayName: profile?.full_name || email,
      });

      if (!account?.id) {
        throw new Error("Stripe no devolvió un ID de cuenta.");
      }

      accountId = account.id;

      const { error: insertError } = await admin
        .from("commerce_connected_accounts")
        .insert({
          user_id: user.id,
          provider: "stripe",
          provider_account_id: accountId,
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

    if (!link?.url) {
      throw new Error("Stripe no devolvió el enlace de onboarding.");
    }

    await admin
      .from("commerce_connected_accounts")
      .update({
        onboarding_status: "onboarding",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true, url: link.url });
  } catch (error: unknown) {
    console.error("Error iniciando onboarding Stripe Connect", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar Stripe Connect.",
      },
      { status: 500 }
    );
  }
}
