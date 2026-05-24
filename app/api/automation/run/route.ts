import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessSuperadmin, hasValidAutomationSecret } from "@/lib/admin/superadmin-access";
import { runAndLogAutomationJob } from "@/lib/automation/run-logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isSecretAuthorized = hasValidAutomationSecret(request);
  const isSuperadmin = user ? await canAccessSuperadmin(user.id, user.email) : false;

  if (!isSecretAuthorized && !isSuperadmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";

  if (!jobId) {
    return NextResponse.json({ ok: false, error: "Missing jobId" }, { status: 400 });
  }

  const result = await runAndLogAutomationJob({
    jobId,
    triggerSource: isSuperadmin ? "manual" : "api",
    triggeredBy: user?.id || null,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
