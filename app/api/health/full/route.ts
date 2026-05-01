import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLaunchEnvSummary, redactEnvValue } from "@/lib/launch/required-env";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckResult = {
  name: string;
  ok: boolean;
  severity: "critical" | "warning" | "info";
  message?: string;
  latencyMs?: number;
};

const REQUIRED_TABLES = [
  "profiles",
  "listings",
  "listing_photos",
  "favorites",
  "conversations",
  "messages",
  "listing_offers",
  "payment_intents",
];

const OPTIONAL_TABLES = [
  "notifications",
  "shipments",
  "transaction_reviews",
  "transaction_issues",
  "saved_searches",
  "user_follows",
  "listing_boosts",
  "course_materials",
  "marketplace_events",
];

async function measure<T>(fn: () => Promise<T>) {
  const start = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - start };
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.LAUNCH_HEALTH_SECRET;
  if (!secret) return true;

  const headerSecret = request.headers.get("x-health-secret");
  const querySecret = request.nextUrl.searchParams.get("secret");

  return headerSecret === secret || querySecret === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized healthcheck" }, { status: 401 });
  }

  const strict = request.nextUrl.searchParams.get("strict") === "1";
  const checks: CheckResult[] = [];
  const envSummary = getLaunchEnvSummary();

  checks.push({
    name: "environment.required",
    ok: envSummary.ok,
    severity: "critical",
    message: envSummary.ok
      ? "Variables obligatorias presentes"
      : `Faltan: ${envSummary.missingRequired.map((item) => item.key).join(", ")}`,
  });

  checks.push({
    name: "environment.recommended",
    ok: envSummary.missingRecommended.length === 0,
    severity: envSummary.missingRecommended.length === 0 ? "info" : "warning",
    message:
      envSummary.missingRecommended.length === 0
        ? "Variables recomendadas presentes"
        : `Recomendadas ausentes: ${envSummary.missingRecommended.map((item) => item.key).join(", ")}`,
  });

  try {
    const { result, latencyMs } = await measure(async () => {
      const supabase = createAdminClient();
      return await supabase.from("listings").select("id", { count: "exact", head: true }).limit(1);
    });

    checks.push({
      name: "supabase.connection",
      ok: !result.error,
      severity: "critical",
      latencyMs,
      message: result.error?.message || "Supabase responde correctamente",
    });
  } catch (error) {
    checks.push({
      name: "supabase.connection",
      ok: false,
      severity: "critical",
      message: error instanceof Error ? error.message : "Supabase no responde",
    });
  }

  try {
    const supabase = createAdminClient();

    for (const table of REQUIRED_TABLES) {
      const { result, latencyMs } = await measure(async () =>
        supabase.from(table).select("*", { count: "exact", head: true }).limit(1)
      );

      checks.push({
        name: `db.required.${table}`,
        ok: !result.error,
        severity: "critical",
        latencyMs,
        message: result.error?.message || "OK",
      });
    }

    for (const table of OPTIONAL_TABLES) {
      const { result, latencyMs } = await measure(async () =>
        supabase.from(table).select("*", { count: "exact", head: true }).limit(1)
      );

      checks.push({
        name: `db.optional.${table}`,
        ok: !result.error,
        severity: result.error ? "warning" : "info",
        latencyMs,
        message: result.error?.message || "OK",
      });
    }
  } catch (error) {
    checks.push({
      name: "db.schema",
      ok: false,
      severity: "critical",
      message: error instanceof Error ? error.message : "No se pudo validar el esquema",
    });
  }

  if (process.env.STRIPE_SECRET_KEY?.trim()) {
    try {
      const { latencyMs } = await measure(async () => await getStripe().balance.retrieve());
      checks.push({
        name: "stripe.api",
        ok: true,
        severity: "critical",
        latencyMs,
        message: "Stripe responde correctamente",
      });
    } catch (error) {
      checks.push({
        name: "stripe.api",
        ok: false,
        severity: "critical",
        message: error instanceof Error ? error.message : "Stripe no responde",
      });
    }
  } else {
    checks.push({
      name: "stripe.api",
      ok: false,
      severity: "critical",
      message: "Falta STRIPE_SECRET_KEY",
    });
  }

  const criticalFailed = checks.filter((check) => check.severity === "critical" && !check.ok);
  const warnings = checks.filter((check) => check.severity === "warning" && !check.ok);
  const ok = criticalFailed.length === 0;

  return NextResponse.json(
    {
      ok,
      strict,
      generatedAt: new Date().toISOString(),
      appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
      environment: {
        requiredOk: envSummary.ok,
        missingRequired: envSummary.missingRequired.map((item) => item.key),
        missingRecommended: envSummary.missingRecommended.map((item) => item.key),
        redacted: envSummary.checks.map((item) => ({
          key: item.key,
          group: item.group,
          severity: item.severity,
          present: item.present,
          value: item.present ? redactEnvValue(item.key) : null,
        })),
      },
      summary: {
        total: checks.length,
        criticalFailed: criticalFailed.length,
        warnings: warnings.length,
      },
      checks,
    },
    { status: ok || !strict ? 200 : 503 }
  );
}
