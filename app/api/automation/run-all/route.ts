import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessSuperadmin, hasValidAutomationSecret } from "@/lib/admin/superadmin-access";
import { DAILY_AUTOMATION_JOB_IDS } from "@/lib/automation/jobs";
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

  const results = [];

  for (const jobId of DAILY_AUTOMATION_JOB_IDS) {
    results.push(
      await runAndLogAutomationJob({
        jobId,
        triggerSource: isSuperadmin ? "manual" : "api",
        triggeredBy: user?.id || null,
      })
    );
  }

  const ok = results.every((result) => result.ok);

  return NextResponse.json({
    ok,
    results,
    generatedAt: new Date().toISOString(),
  }, { status: ok ? 200 : 500 });
}
