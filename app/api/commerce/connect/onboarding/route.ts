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

void createClient;
void createAdminClient;
void assertStripeTestMode;
void canUserAccessPrivateCommercePreview;
void createStripeRecipientAccount;
void createStripeRecipientOnboardingLink;

export async function POST() {
  return NextResponse.json({ ok: true });
}
