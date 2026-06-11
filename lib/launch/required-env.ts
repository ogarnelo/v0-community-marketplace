export type EnvCheckSeverity = "required" | "recommended" | "optional";

export type EnvCheck = {
  key: string;
  label: string;
  severity: EnvCheckSeverity;
  present: boolean;
  group: "supabase" | "stripe" | "email" | "app" | "logistics" | "monitoring";
};

const ENV_RULES: Array<Omit<EnvCheck, "present">> = [
  { key: "NEXT_PUBLIC_APP_URL", label: "URL pública de la aplicación", severity: "required", group: "app" },
  { key: "NEXT_PUBLIC_SUPABASE_URL", label: "URL pública de Supabase", severity: "required", group: "supabase" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Anon key de Supabase", severity: "required", group: "supabase" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Service role key de Supabase", severity: "required", group: "supabase" },
  { key: "STRIPE_SECRET_KEY", label: "Stripe secret key", severity: "required", group: "stripe" },
  { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe webhook secret", severity: "required", group: "stripe" },
  { key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", label: "Stripe publishable key pública", severity: "required", group: "stripe" },
  { key: "LAUNCH_HEALTH_SECRET", label: "Secreto para healthchecks externos", severity: "recommended", group: "monitoring" },
  { key: "RESEND_API_KEY", label: "Resend API key", severity: "recommended", group: "email" },
  { key: "RESEND_FROM_EMAIL", label: "Email remitente transaccional", severity: "recommended", group: "email" },
  { key: "SENDCLOUD_PUBLIC_KEY", label: "Sendcloud public key", severity: "optional", group: "logistics" },
  { key: "SENDCLOUD_SECRET_KEY", label: "Sendcloud secret key", severity: "optional", group: "logistics" },
  { key: "SHIPPO_API_KEY", label: "Shippo API key", severity: "optional", group: "logistics" },
  { key: "EASYPOST_API_KEY", label: "EasyPost API key", severity: "optional", group: "logistics" },
];

export function getLaunchEnvChecks(): EnvCheck[] {
  return ENV_RULES.map((rule) => ({
    ...rule,
    present: Boolean(process.env[rule.key]?.trim()),
  }));
}

export function getLaunchEnvSummary() {
  const checks = getLaunchEnvChecks();
  const missingRequired = checks.filter((item) => item.severity === "required" && !item.present);
  const missingRecommended = checks.filter((item) => item.severity === "recommended" && !item.present);

  return {
    ok: missingRequired.length === 0,
    checks,
    missingRequired,
    missingRecommended,
  };
}
