import { createAdminClient } from "@/lib/supabase/admin";
import { sendSuperAdminReportEmail } from "@/lib/emails/super-admin-report-email";
import {
  loadSuperAdminReport,
  normalizeSuperAdminRange,
} from "@/lib/reports/super-admin-report";

type SubscriptionRow = {
  id: string;
  user_id: string;
  email: string;
  frequency_days: number;
  report_range: string;
  report_format: "pdf" | "csv" | "both";
  next_send_at: string | null;
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return new Response(null, { status: 204 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const admin = createAdminClient();

  const { data: subscriptions, error } = await admin
    .from("super_admin_report_subscriptions")
    .select("id, user_id, email, frequency_days, report_range, report_format, next_send_at")
    .eq("enabled", true)
    .lte("next_send_at", nowIso)
    .returns<SubscriptionRow[]>();

  if (error) {
    console.error("Error cargando informes globales:", error);
    return Response.json({ ok: false }, { status: 500 });
  }

  let sent = 0;
  const failures: Array<{ id: string; message: string }> = [];

  for (const subscription of subscriptions || []) {
    try {
      const report = await loadSuperAdminReport(
        normalizeSuperAdminRange(subscription.report_range)
      );
      const scheduledFor = subscription.next_send_at || nowIso;

      await sendSuperAdminReportEmail({
        to: subscription.email,
        subscriptionId: subscription.id,
        report,
        format: subscription.report_format,
        scheduledFor,
      });

      const next = new Date(now);
      next.setUTCDate(next.getUTCDate() + subscription.frequency_days);

      const { error: updateError } = await admin
        .from("super_admin_report_subscriptions")
        .update({
          last_sent_at: nowIso,
          next_send_at: next.toISOString(),
          updated_at: nowIso,
        })
        .eq("id", subscription.id)
        .eq("next_send_at", scheduledFor);

      if (updateError) throw updateError;
      sent += 1;
    } catch (cause: any) {
      failures.push({
        id: subscription.id,
        message: cause?.message || "Error desconocido",
      });
    }
  }

  if (failures.length > 0) {
    console.error("Fallos enviando informes globales:", failures);
  }

  return Response.json({
    ok: failures.length === 0,
    sent,
    failed: failures.length,
  });
}
