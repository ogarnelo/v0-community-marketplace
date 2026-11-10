import { createAdminClient } from "@/lib/supabase/admin";
import { refreshEmailHealthMonitoring } from "@/lib/admin/email-health-monitoring";
import { pruneEmailTelemetry } from "@/lib/admin/email-telemetry-retention";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return new Response(null, { status: 204 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const result = await refreshEmailHealthMonitoring(admin);

    let telemetryRetention:
      | Awaited<ReturnType<typeof pruneEmailTelemetry>>
      | { error: true } = { error: true };

    try {
      telemetryRetention = await pruneEmailTelemetry(admin);
    } catch (retentionError) {
      console.error("Error purgando telemetría antigua de email:", retentionError);
    }

    // Reuse the existing authorized daily cron for read-only backlog metrics.
    // No new scheduled job, email or automatic outbox processing.
    let marketplaceAlertOutbox: Record<string, number | boolean> = { available: false };
    try {
      const { data: health, error: outboxError } = await admin
        .rpc("marketplace_alert_outbox_health_v1")
        .single();
      if (outboxError) throw outboxError;
      if (!health) throw new Error("Missing alert outbox health");
      marketplaceAlertOutbox = {
        available: true,
        total: Number(health.total ?? 0),
        pending: Number(health.pending ?? 0),
        processing: Number(health.processing ?? 0),
        completed: Number(health.completed ?? 0),
        failed: Number(health.failed ?? 0),
        due: Number(health.due ?? 0),
        overdueLeases: Number(health.overdue_leases ?? 0),
        expiredUnfinished: Number(health.expired_unfinished ?? 0),
        oldestUnfinishedMinutes: Number(health.oldest_unfinished_minutes ?? 0),
        maxAttempts: Number(health.max_attempts ?? 0),
      };
      // Logs contain only totals; warnings are actionable only if the worker
      // has been explicitly activated. During QA staging expired backlog is
      // expected while recovery remains disabled.
      if (process.env.WETUDY_ALERT_OUTBOX_ENABLED === "true" &&
        (marketplaceAlertOutbox.failed > 0 ||
         marketplaceAlertOutbox.overdueLeases > 0 ||
         marketplaceAlertOutbox.expiredUnfinished > 0)) {
        console.warn("Incidencias de cola de avisos", {
          failed: marketplaceAlertOutbox.failed,
          overdueLeases: marketplaceAlertOutbox.overdueLeases,
          expiredUnfinished: marketplaceAlertOutbox.expiredUnfinished,
        });
      }
    } catch (outboxHealthError) {
      // Outbox observability must never block the pre-existing email-health
      // snapshots or retention job.
      console.warn("No se pudo consultar la cola de avisos", outboxHealthError instanceof Error
        ? outboxHealthError.name : "unknown");
    }

    return Response.json({
      ok: true,
      snapshotDate: result.snapshotDate,
      total: result.health.total,
      alerts: result.health.alerts.map((alert) => alert.key),
      transitions: result.transitions,
      telemetryRetention,
      marketplaceAlertOutbox,
    });
  } catch (error: any) {
    console.error("Error refrescando salud de email:", error);
    return Response.json(
      { ok: false, error: error?.message || "No se pudo refrescar la salud de email." },
      { status: 500 }
    );
  }
}
