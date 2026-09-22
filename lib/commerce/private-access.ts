import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function splitAllowlist(value?: string) {
  return new Set(
    (value || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isPublicCommerceEnabled() {
  return process.env.ENABLE_LEGACY_COMMERCE === "true";
}

export function isPrivateCommercePreviewEnabled() {
  return process.env.ENABLE_PRIVATE_COMMERCE_PREVIEW === "true";
}

export function isPrivateShippingLabelCreationEnabled() {
  return process.env.ENABLE_PRIVATE_COMMERCE_SENDCLOUD_LABELS === "true";
}

export function assertStripeTestMode() {
  const secret = process.env.STRIPE_SECRET_KEY || "";
  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

  if (!secret.startsWith("sk_test_") || !publishable.startsWith("pk_test_")) {
    throw new Error(
      "La previsualización privada de comercio exige claves Stripe de test."
    );
  }
}

export async function canUserAccessPrivateCommercePreview(user?: User | null) {
  if (!isPrivateCommercePreviewEnabled() || !user) return false;

  const allowlist = splitAllowlist(process.env.PRIVATE_COMMERCE_TESTER_EMAILS);
  if (user.email && allowlist.has(user.email.toLowerCase())) return true;

  const supabase = await createClient();
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  return Boolean(roles?.length);
}

export async function canUserUseCommerce(user?: User | null) {
  if (isPublicCommerceEnabled()) return Boolean(user);
  return canUserAccessPrivateCommercePreview(user);
}
