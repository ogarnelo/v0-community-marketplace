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
  // The subscription day is a calendar day in the pilot's local timezone.
  // UTC can already be the following day while Madrid is still on the prior date.
  const day = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    day: "numeric",
  }).format(now));
  const period = previousCalendarMonth(now);
  const admin = createAdminClient();

  const { data: subscriptions, error } = await admin
    .from("school_impact_report_subscriptions")
    .select("id, school_id, user_id, email, day_of_month, last_sent_month")
    .eq("enabled", true)
    .eq("day_of_month", day)
    .returns<SubscriptionRow[]>();

  if (error) {
    console.error("school_impact_cron_subscriptions_read_failed");
    return Response.json({ ok: false }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let unrecorded = 0;

  for (const subscription of subscriptions || []) {
    if (subscription.last_sent_month === period.key) {
      skipped += 1;
      continue;
    }

    try {
      // Revalidate legacy subscriptions at send time: a saved arbitrary email
      // must never bypass the restriction introduced on the API routes.
      const { data: account, error: accountError } = await admin.auth.admin.getUserById(subscription.user_id);
      if (accountError || !account?.user?.email_confirmed_at ||
          !account.user.email ||
          account.user.email.trim().toLowerCase() !== subscription.email.trim().toLowerCase()) {
        skipped += 1;
        continue;
      }
      const { data: currentRole, error: currentRoleError } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("user_id", subscription.user_id)
        .eq("school_id", subscription.school_id)
        .eq("role", "school_admin")
        .maybeSingle();
      if (currentRoleError) throw currentRoleError;
      if (!currentRole) {
        skipped += 1;
        continue;
      }

      // Recheck the centre before privileged report data is loaded, not only
      // after rendering. A revoked or deactivated school has no report access.
      const { data: currentSchool, error: schoolError } = await admin
        .from("schools")
        .select("id, is_active")
        .eq("id", subscription.school_id)
        .maybeSingle();
      if (schoolError) throw new Error("school_status_unavailable");
      if (!currentSchool || currentSchool.is_active !== true) {
        skipped += 1;
        continue;
      }

      const report = await loadSchoolImpactReport({
        schoolId: subscription.school_id,
        start: period.start,
        end: period.end,
        periodLabel: period.label,
        periodKey: period.key,
      });

      if (!report?.school || report.school.is_active !== true) {
        skipped += 1;
        continue;
      }

      const pdf = renderSchoolImpactPdf(report);
      const emailResult = await sendMonthlySchoolImpactEmail({
        to: subscription.email,
        report,
        pdf,
      });

      const providerMessageId =
        emailResult && typeof emailResult === "object" && "id" in emailResult && typeof emailResult.id === "string"
          ? emailResult.id
          : null;

      const { error: deliveryError } = await admin
        .from("school_impact_report_deliveries")
        .insert({
          school_id: subscription.school_id,
          user_id: subscription.user_id,
          email: subscription.email,
          period_key: period.key,
          period_label: period.label,
          source: "cron",
          provider_message_id: providerMessageId,
        });

      if (deliveryError) {
        // The provider has accepted the report. Preserve last_sent_month to
        // avoid a duplicate next run, but surface that its audit row is missing.
        unrecorded += 1;
        console.error("school_impact_cron_delivery_record_failed");
      }

      const { error: updateError } = await admin
        .from("school_impact_report_subscriptions")
        .update({
          last_sent_month: period.key,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      if (updateError) throw updateError;
      sent += 1;
    } catch {
      // Subscription IDs and provider/SQL exception messages may contain private
      // details. Report aggregate failure only, never echo individual records.
      failed += 1;
    }
  }

  if (failed > 0) {
    console.error("school_impact_cron_delivery_failed");
  }

  return Response.json({
    ok: failed === 0 && unrecorded === 0,
    period: period.key,
    sent,
    skipped,
    failed,
    unrecorded,
  });
}
