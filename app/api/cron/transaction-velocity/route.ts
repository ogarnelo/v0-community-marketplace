import { NextResponse } from "next/server";
import { hasValidAutomationSecret } from "@/lib/admin/superadmin-access";
import { runTransactionVelocityRules } from "@/lib/transaction-velocity/rules";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasValidAutomationSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron" }, { status: 401 });
  }

  const result = await runTransactionVelocityRules();

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
