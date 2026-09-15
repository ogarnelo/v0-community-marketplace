import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildSandboxPlan, type PaymentShippingSandboxScenario } from "@/lib/sandbox/payment-shipping";

const allowedScenarios = new Set<PaymentShippingSandboxScenario>([
  "stripe_connect_onboarding",
  "protected_payment_hold",
  "protected_payment_release",
  "protected_payment_refund",
  "correos_label_quote",
  "shipping_aggregator_quote",
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const { data: isSuperadmin, error: roleError } = await supabase.rpc("is_superadmin");
  if (roleError || !isSuperadmin) {
    return NextResponse.json({ ok: false, error: "admin_required" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const scenario = typeof body.scenario === "string" && allowedScenarios.has(body.scenario as PaymentShippingSandboxScenario)
    ? (body.scenario as PaymentShippingSandboxScenario)
    : "stripe_connect_onboarding";

  const plan = buildSandboxPlan(scenario);

  const { error } = await supabase.from("payment_shipping_sandbox_runs").insert({
    created_by: user.id,
    provider: plan.provider,
    mode: plan.mode,
    scenario: plan.scenario,
    amount_cents: typeof body.amountCents === "number" ? Math.max(0, Math.round(body.amountCents)) : null,
    currency: typeof body.currency === "string" ? body.currency.toLowerCase().slice(0, 3) : "eur",
    status: "planned",
    request_payload: body,
    response_payload: plan,
    notes: "Sandbox técnico. No visible para usuarios.",
  });

  if (error) {
    console.error("Error guardando sandbox payment/shipping:", error);
    return NextResponse.json({ ok: false, error: "insert_failed", plan }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plan });
}
