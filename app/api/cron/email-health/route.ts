import { createAdminClient } from "@/lib/supabase/admin";
import { refreshEmailHealthMonitoring } from "@/lib/admin/email-health-monitoring";

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

    return Response.json({
      ok: true,
      snapshotDate: result.snapshotDate,
      total: result.health.total,
      alerts: result.health.alerts.map((alert) => alert.key),
      transitions: result.transitions,
    });
  } catch (error: any) {
    console.error("Error refrescando salud de email:", error);
    return Response.json(
      { ok: false, error: error?.message || "No se pudo refrescar la salud de email." },
      { status: 500 }
    );
  }
}
