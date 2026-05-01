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
  { key: "RESEND_API_KEY", label: "Resend API key", severity: "recommended", group: "email" },
  { key: "RESEND_FROM_EMAIL", label: "Email remitente transaccional", severity: "recommended", group: "email" },
  { key: "SHIPPO_API_KEY", label: "Shippo API key", severity: "optional", group: "logistics" },
  { key: "EASYPOST_API_KEY", label: "EasyPost API key", severity: "optional", group: "logistics" },
  { key: "LAUNCH_HEALTH_SECRET", label: "Secreto opcional para healthcheck externo", severity: "optional", group: "monitoring" },
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

export function redactEnvValue(key: string) {
  const value = process.env[key];
  if (!value) return null;
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
