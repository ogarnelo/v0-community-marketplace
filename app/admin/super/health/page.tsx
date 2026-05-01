import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLaunchEnvSummary } from "@/lib/launch/required-env";

export const dynamic = "force-dynamic";

type HealthPayload = {
  ok: boolean;
  generatedAt: string;
  summary: {
    total: number;
    criticalFailed: number;
    warnings: number;
  };
  checks: Array<{
    name: string;
    ok: boolean;
    severity: "critical" | "warning" | "info";
    message?: string;
    latencyMs?: number;
  }>;
};

function StatusPill({ ok, severity }: { ok: boolean; severity: string }) {
  const className = ok
    ? "bg-emerald-100 text-emerald-800"
    : severity === "critical"
      ? "bg-red-100 text-red-800"
      : "bg-amber-100 text-amber-800";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {ok ? "OK" : severity === "critical" ? "CRÍTICO" : "AVISO"}
    </span>
  );
}

export default async function SuperHealthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  let isSuperAdmin = false;
  try {
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();
    isSuperAdmin = Boolean(role);
  } catch {
    isSuperAdmin = false;
  }

  if (!isSuperAdmin) redirect("/account");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const healthUrl = `${appUrl}/api/health/full${process.env.LAUNCH_HEALTH_SECRET ? `?secret=${process.env.LAUNCH_HEALTH_SECRET}` : ""}`;

  let health: HealthPayload | null = null;
  try {
    const response = await fetch(healthUrl, { cache: "no-store" });
    health = await response.json();
  } catch {
    health = null;
  }

  const envSummary = getLaunchEnvSummary();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Healthcheck de lanzamiento</h1>
          <p className="mt-2 text-muted-foreground">
            Estado de variables, Supabase, tablas críticas y Stripe antes de abrir tráfico real.
          </p>
        </div>
        <Link href="/admin/super" className="inline-flex rounded-lg border px-4 py-2 text-sm font-medium">
          Volver al panel
        </Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Estado general</p>
          <p className={`mt-2 text-3xl font-bold ${health?.ok ? "text-emerald-700" : "text-red-700"}`}>
            {health?.ok ? "OK" : "Revisar"}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Fallos críticos</p>
          <p className="mt-2 text-3xl font-bold">{health?.summary.criticalFailed ?? "—"}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Variables obligatorias</p>
          <p className={`mt-2 text-3xl font-bold ${envSummary.ok ? "text-emerald-700" : "text-red-700"}`}>
            {envSummary.ok ? "OK" : envSummary.missingRequired.length}
          </p>
        </div>
      </div>

      {!health ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
          No se pudo consultar <code>/api/health/full</code>.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="border-b p-4">
            <h2 className="text-lg font-semibold">Checks</h2>
            <p className="text-sm text-muted-foreground">Generado el {new Date(health.generatedAt).toLocaleString("es-ES")}</p>
          </div>
          <div className="divide-y">
            {health.checks.map((check) => (
              <div key={check.name} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-medium">{check.name}</p>
                  {check.message ? <p className="mt-1 text-sm text-muted-foreground">{check.message}</p> : null}
                  {typeof check.latencyMs === "number" ? (
                    <p className="mt-1 text-xs text-muted-foreground">{check.latencyMs} ms</p>
                  ) : null}
                </div>
                <StatusPill ok={check.ok} severity={check.severity} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
