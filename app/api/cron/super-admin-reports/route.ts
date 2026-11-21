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
    return Response.json({ ok: false, error: "cron_auth_unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Keep automated attachment delivery dormant until durable exclusive claims
  // and ambiguous provider outcomes have passed the R1 acceptance gate.
  if (process.env.WETUDY_SUPER_ADMIN_REPORT_EMAIL_ENABLED !== "true") {
    return Response.json({ ok: true, paused: true }, {
      headers: { "Cache-Control": "private, no-store" },
    });
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
    console.error("super_admin_report_subscription_read_failed");
    return Response.json({ ok: false }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  async function recipientStillAuthorized(subscription: SubscriptionRow) {
    const identity = await admin.auth.admin.getUserById(subscription.user_id);
    if (identity.error) throw new Error("recipient_identity_unavailable");
    const user = identity.data?.user;
    if (!user || user.id !== subscription.user_id || !user.email_confirmed_at ||
      (user.email || "").trim().toLowerCase() !== subscription.email.trim().toLowerCase()) return false;
    const roles = await admin.from("user_roles").select("role")
      .eq("user_id", subscription.user_id).eq("role", "super_admin").limit(1);
    if (roles.error) throw new Error("recipient_role_unavailable");
    if (!roles.data?.length) return false;
    const fresh = await admin.from("super_admin_report_subscriptions")
      .select("id").eq("id", subscription.id).eq("user_id", subscription.user_id)
      .eq("email", subscription.email).eq("enabled", true)
      .eq("frequency_days", subscription.frequency_days).eq("report_range", subscription.report_range)
      .eq("report_format", subscription.report_format).eq("next_send_at", subscription.next_send_at!).maybeSingle();
    if (fresh.error) throw new Error("recipient_subscription_unavailable");
    return Boolean(fresh.data?.id);
  }

  for (const subscription of subscriptions || []) {
    try {
      if (!subscription.next_send_at || !(await recipientStillAuthorized(subscription))) { skipped++; continue; }
      const report = await loadSuperAdminReport(
        normalizeSuperAdminRange(subscription.report_range)
      );
      const scheduledFor = subscription.next_send_at || nowIso;

      if (!(await recipientStillAuthorized(subscription))) { skipped++; continue; }
      const claim = await admin.rpc("r1_global_report_claim", {
        p_subscription_id: subscription.id, p_user_id: subscription.user_id,
        p_scheduled_for: scheduledFor, p_email: subscription.email,
        p_frequency: subscription.frequency_days, p_range: subscription.report_range,
        p_format: subscription.report_format,
      });
      if (claim.error) throw new Error("dispatch_claim_unavailable");
      if (claim.data === null) { skipped++; continue; }
      if (typeof claim.data !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claim.data))
        throw new Error("dispatch_claim_invalid");
      // Never release an acquired claim automatically, even after revocation,
      // timeout or ambiguous provider response. Reconciliation is offline.
      if (!(await recipientStillAuthorized(subscription))) { skipped++; continue; }
      const delivery = await sendSuperAdminReportEmail({
        to: subscription.email,
        subscriptionId: subscription.id,
        report,
        format: subscription.report_format,
        scheduledFor,
      });

      if (!delivery || delivery.skipped === true ||
          typeof delivery.id !== "string" || !delivery.id.trim()) {
        throw new Error("delivery_provider_unconfirmed");
      }

      const ack = await admin.rpc("r1_global_report_ack", {
        p_claim_id: claim.data, p_provider_id: delivery.id,
      });
      if (ack.error || ack.data !== true) throw new Error("dispatch_ack_unconfirmed");
      const next = new Date(now);
      next.setUTCDate(next.getUTCDate() + subscription.frequency_days);

      const { data: updated, error: updateError } = await admin
        .from("super_admin_report_subscriptions")
        .update({
          last_sent_at: nowIso,
          next_send_at: next.toISOString(),
          updated_at: nowIso,
        })
        .eq("id", subscription.id)
        .eq("next_send_at", scheduledFor).eq("enabled", true)
        .eq("email", subscription.email).eq("user_id", subscription.user_id)
        .eq("frequency_days", subscription.frequency_days).eq("report_range", subscription.report_range)
        .eq("report_format", subscription.report_format)
        .select("id").maybeSingle();

      if (updateError || !updated?.id) throw new Error("delivery_settlement_unconfirmed");
      sent += 1;
    } catch {
      failed++;
    }
  }

  if (failed > 0) console.error("super_admin_report_delivery_failed", failed);

  return Response.json({
    ok: failed === 0,
    sent,
    failed, skipped,
  }, { status: failed > 0 ? 503 : 200, headers: { "Cache-Control": "private, no-store" } });
}
