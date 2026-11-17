import { NextResponse } from "next/server";
import { getVerifiedCommerceUser } from "@/lib/commerce/verified-user";
import {
  assertStripeTestMode,
  canUserAccessPrivateCommercePreview,
} from "@/lib/commerce/private-access";
import { ensureSellerConnectAccount } from "@/lib/commerce/connect";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const auth = await getVerifiedCommerceUser();
  if (!auth.user) {
    const dest = auth.errorStatus === 401 ? "/auth" : "/account/commerce-preview?connect=error";
    return NextResponse.redirect(new URL(dest, request.url), { headers: PRIVATE_HEADERS });
  }
  const user = auth.user;

  try {
    if (!(await canUserAccessPrivateCommercePreview(user))) {
      return NextResponse.redirect(new URL("/account", request.url), { headers: PRIVATE_HEADERS });
    }
    assertStripeTestMode();
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
    });

    return NextResponse.redirect(accountLink.url, { headers: PRIVATE_HEADERS });
  } catch {
    console.error("seller_connect_onboarding_refresh_failed");
    return NextResponse.redirect(
      new URL("/account/commerce-preview?connect=error", request.url),
      { headers: PRIVATE_HEADERS }
    );
  }
}
