import { createAdminClient } from "@/lib/supabase/admin";

const FALLBACK_SUPERADMIN_EMAILS = ["oscar_garnelo@hotmail.com"];

export function configuredSuperadminEmails() {
  const fromEnv =
    process.env.SUPERADMIN_EMAILS?.split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean) || [];

  return new Set([...FALLBACK_SUPERADMIN_EMAILS, ...fromEnv].map((item) => item.toLowerCase()));
}

export async function canAccessSuperadmin(userId: string, email?: string | null) {
  const admin = createAdminClient();

  try {
    const { data } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (data?.role === "super_admin") return true;
  } catch {
    // Fallback temporal por compatibilidad con paneles existentes.
  }

  return Boolean(email && configuredSuperadminEmails().has(email.toLowerCase()));
}

export function hasValidAutomationSecret(request: Request) {
  const secret = process.env.LAUNCH_HEALTH_SECRET;
  const url = new URL(request.url);
  const provided =
    url.searchParams.get("secret") ||
    request.headers.get("x-automation-secret") ||
    request.headers.get("x-health-secret");

  return Boolean(secret && provided && provided === secret);
}

