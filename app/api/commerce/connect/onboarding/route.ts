import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  assertStripeTestMode,
  canUserUseCommerce,
  isPublicCommerceEnabled,
} from "@/lib/commerce/private-access";
import { ensureSellerConnectAccount } from "@/lib/commerce/connect";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  if (!(await canUserUseCommerce(user))) {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  if (!isPublicCommerceEnabled()) assertStripeTestMode();

  try {
    const { account } = await ensureSellerConnectAccount({
      userId: user.id,
      email: user.email,
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: new URL("/api/commerce/connect/onboarding", request.url).toString(),
      return_url: new URL(
        "/account/commerce-preview?connect=return",
        request.url
      ).toString(),
      type: "account_onboarding",
      collection_options: {
        fields: "eventually_due",
        future_requirements: "include",
      },
    });

    return NextResponse.redirect(accountLink.url);
  } catch (error) {
    console.error("No se pudo regenerar onboarding Connect", error);
    return NextResponse.redirect(
      new URL("/account/commerce-preview?connect=error", request.url)
    );
  }
}
