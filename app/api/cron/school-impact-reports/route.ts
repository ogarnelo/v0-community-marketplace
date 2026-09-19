import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadSchoolImpactReport,
  previousCalendarMonth,
  renderSchoolImpactPdf,
} from "@/lib/reports/school-impact-report";
import { sendMonthlySchoolImpactEmail } from "@/lib/emails/school-impact-report-email";

type SubscriptionRow = {
  id: string;
  school_id: string;
  user_id: string;
  email: string;
  day_of_month: number;
  last_sent_month: string | null;
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
  const day = now.getUTCDate();
  const period = previousCalendarMonth(now);
  const admin = createAdminClient();

  const { data: subscriptions, error } = await admin
    .from("school_impact_report_subscriptions")
    .select("id, school_id, user_id, email, day_of_month, last_sent_month")
    .eq("enabled", true)
    .eq("day_of_month", day)
    .returns<SubscriptionRow[]>();

  if (error) {
    console.error("Error cargando reportes mensuales:", error);
    return Response.json({ ok: false }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  const failures: Array<{ id: string; message: string }> = [];

  for (const subscription of subscriptions || []) {
    if (subscription.last_sent_month === period.key) {
      skipped += 1;
      continue;
    }

    try {
      const report = await loadSchoolImpactReport({
        schoolId: subscription.school_id,
        start: period.start,
        end: period.end,
        periodLabel: period.label,
        periodKey: period.key,
      });

      if (report.school.is_active === false) {
        skipped += 1;
        continue;
      }

      const pdf = renderSchoolImpactPdf(report);
      await sendMonthlySchoolImpactEmail({
        to: subscription.email,
        report,
        pdf,
      });

      const { error: updateError } = await admin
        .from("school_impact_report_subscriptions")
        .update({
          last_sent_month: period.key,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

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
    console.error("Fallos enviando informes mensuales de impacto:", failures);
  }

  return Response.json({
    ok: failures.length === 0,
    period: period.key,
    sent,
    skipped,
    failed: failures.length,
  });
}
