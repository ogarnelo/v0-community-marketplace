import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertStripeTestMode,
  canUserAccessPrivateCommercePreview,
} from "@/lib/commerce/private-access";
import { createStripeRecipientOnboardingLink } from "@/lib/commerce/stripe-connect-v2";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await canUserAccessPrivateCommercePreview(user))) {
    return NextResponse.redirect(new URL("/account", request.url));
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
      return NextResponse.redirect(new URL("/account/commerce", request.url));
    }

    const origin = new URL(request.url).origin;
    const link = await createStripeRecipientOnboardingLink({
      accountId: account.provider_account_id,
      refreshUrl: `${origin}/api/commerce/connect/refresh`,
      returnUrl: `${origin}/account/commerce?connect=returned`,
    });

    return NextResponse.redirect(link.url);
  } catch (error) {
    console.error("Error refrescando onboarding Stripe Connect", error);
    return NextResponse.redirect(new URL("/account/commerce?connect=error", request.url));
  }
}
