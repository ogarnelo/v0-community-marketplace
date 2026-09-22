import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  assertStripeTestMode,
  canUserAccessPrivateCommercePreview,
} from "@/lib/commerce/private-access";
import {
  ensureSellerConnectAccount,
  syncSellerConnectAccount,
} from "@/lib/commerce/connect";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!(await canUserAccessPrivateCommercePreview(user))) {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }
  assertStripeTestMode();

  try {
    const admin = createAdminClient();
    const { data: existing, error: lookupError } = await admin
      .from("seller_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing?.stripe_account_id) {
      return NextResponse.json({ ok: true, account: null });
    }

    const { account, status } = await syncSellerConnectAccount({
      userId: user.id,
      stripeAccountId: existing.stripe_account_id,
    });

    return NextResponse.json({
      ok: true,
      account: {
        id: account.id,
        country: account.country,
        defaultCurrency: account.default_currency,
        ...status,
      },
    });
  } catch (error) {
    console.error("No se pudo cargar Stripe Connect", error);
    return NextResponse.json(
      { error: "No se pudo cargar el estado de cobros del vendedor." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!(await canUserAccessPrivateCommercePreview(user))) {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }
  assertStripeTestMode();

  try {
    const { account } = await ensureSellerConnectAccount({
      userId: user.id,
      email: user.email,
    });

    await syncSellerConnectAccount({
      userId: user.id,
      stripeAccountId: account.id,
    });

    const refreshUrl = new URL(
      "/api/commerce/connect/onboarding",
      request.url
    );
    const returnUrl = new URL(
      "/account/commerce-preview?connect=return",
      request.url
    );

    const accountLinks = (stripe as any).accountLinks;
    if (!accountLinks?.create) {
      throw new Error("La versión instalada de Stripe no expone Account Links.");
    }

    const accountLink = await accountLinks.create({
      account: account.id,
      refresh_url: refreshUrl.toString(),
      return_url: returnUrl.toString(),
      type: "account_onboarding",
      collection_options: {
        fields: "eventually_due",
        future_requirements: "include",
      },
    });

    return NextResponse.json({ ok: true, url: accountLink.url });
  } catch (error) {
    console.error("No se pudo iniciar onboarding Stripe Connect", error);
    return NextResponse.json(
      { error: "No se pudo iniciar la verificación con Stripe." },
      { status: 500 }
    );
  }
}
