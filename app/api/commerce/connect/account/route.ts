import { NextResponse } from "next/server";
import { getVerifiedCommerceUser } from "@/lib/commerce/verified-user";
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
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(payload: unknown, opts: {status?:number}={}) {
  return NextResponse.json(payload, {...opts, headers: PRIVATE_HEADERS});
}

export async function GET() {
  const auth = await getVerifiedCommerceUser();
  if (!auth.user) return privateJson(
    { error: auth.errorStatus === 401 ? "No autenticado." : "No se pudo comprobar tu sesión." },
    { status: auth.errorStatus ?? 503 }
  );
  const user = auth.user;

  try {
    if (!(await canUserAccessPrivateCommercePreview(user))) {
      return privateJson({ error: "No disponible." }, { status: 404 });
    }
    assertStripeTestMode();
    const admin = createAdminClient();
    const { data: existing, error: lookupError } = await admin
      .from("seller_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing?.stripe_account_id) {
      return privateJson({ ok: true, account: null });
    }

    const { account, status } = await syncSellerConnectAccount({
      userId: user.id,
      stripeAccountId: existing.stripe_account_id,
    });

    return privateJson({
      ok: true,
      account: {
        id: account.id,
        country: account.country,
        defaultCurrency: account.default_currency,
        ...status,
      },
    });
  } catch {
    console.error("seller_connect_state_failed");
    return privateJson(
      { error: "No se pudo cargar el estado de cobros del vendedor." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await getVerifiedCommerceUser();
  if (!auth.user) return privateJson(
    { error: auth.errorStatus === 401 ? "No autenticado." : "No se pudo comprobar tu sesión." },
    { status: auth.errorStatus ?? 503 }
  );
  const user = auth.user;

  try {
    if (!(await canUserAccessPrivateCommercePreview(user))) {
      return privateJson({ error: "No disponible." }, { status: 404 });
    }
    assertStripeTestMode();
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

    return privateJson({ ok: true, url: accountLink.url });
  } catch {
    console.error("seller_connect_onboarding_failed");
    return privateJson(
      { error: "No se pudo iniciar la verificación con Stripe." },
      { status: 500 }
    );
  }
}
