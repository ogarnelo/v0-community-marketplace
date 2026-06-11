import { createAdminClient } from "@/lib/supabase/admin";
import { getAutomationJob, runAutomationJob } from "@/lib/automation/jobs";

function safeResult(input: unknown) {
  try {
    return JSON.parse(JSON.stringify(input ?? {}));
  } catch {
    return { value: String(input).slice(0, 1000) };
  }
}

export async function runAndLogAutomationJob(input: {
  jobId: string;
  triggerSource: "manual" | "cron" | "api" | "system";
  triggeredBy?: string | null;
}) {
  const admin = createAdminClient();
  const job = getAutomationJob(input.jobId);

  if (!job) {
    return {
      ok: false,
      message: "Automation job not found.",
      status: "failed" as const,
      result: { jobId: input.jobId },
    };
  }

  const startedAt = new Date();
  const { data: runRow } = await admin
    .from("automation_runs")
    .insert({
      job_id: job.id,
      job_name: job.name,
      status: "running",
      trigger_source: input.triggerSource,
      triggered_by: input.triggeredBy || null,
      started_at: startedAt.toISOString(),
      ok: false,
      message: "Running",
    })
    .select("id")
    .single();

  try {
    const outcome = await runAutomationJob(job.id);
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const status = outcome.ok ? "succeeded" : "failed";

    if (runRow?.id) {
      await admin
        .from("automation_runs")
        .update({
          status,
          ok: outcome.ok,
          finished_at: finishedAt.toISOString(),
          duration_ms: durationMs,
          message: outcome.message,
          result: safeResult(outcome.result),
          error: outcome.ok ? null : outcome.message,
        })
        .eq("id", runRow.id);
    }

    return {
      ...outcome,
      status,
      durationMs,
      runId: runRow?.id || null,
    };
  } catch (error) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const message = error instanceof Error ? error.message : "Unknown automation error.";

    if (runRow?.id) {
      await admin
        .from("automation_runs")
        .update({
          status: "failed",
          ok: false,
          finished_at: finishedAt.toISOString(),
          duration_ms: durationMs,
          message,
          error: message,
          result: {},
        })
        .eq("id", runRow.id);
    }

    return {
      ok: false,
      status: "failed" as const,
      message,
      durationMs,
      runId: runRow?.id || null,
      result: {},
    };
  }
}
