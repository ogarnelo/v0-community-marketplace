import { NextResponse } from "next/server";
import { hasValidAutomationSecret } from "@/lib/admin/superadmin-access";
import { DAILY_AUTOMATION_JOB_IDS } from "@/lib/automation/jobs";
import { runAndLogAutomationJob } from "@/lib/automation/run-logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasValidAutomationSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron" }, { status: 401 });
  }

  const results = [];

  for (const jobId of DAILY_AUTOMATION_JOB_IDS) {
    results.push(
      await runAndLogAutomationJob({
        jobId,
        triggerSource: "cron",
        triggeredBy: null,
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
