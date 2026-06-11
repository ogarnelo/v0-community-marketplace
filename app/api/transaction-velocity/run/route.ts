import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessSuperadmin, hasValidAutomationSecret } from "@/lib/admin/superadmin-access";
import { runTransactionVelocityRules } from "@/lib/transaction-velocity/rules";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const bySecret = hasValidAutomationSecret(request);
  const bySuperadmin = user ? await canAccessSuperadmin(user.id, user.email) : false;

  if (!bySecret && !bySuperadmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runTransactionVelocityRules();

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(request: Request) {
  return POST(request);
}
