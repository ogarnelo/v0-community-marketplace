import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const BOUNCE_ALERT_THRESHOLD_PERCENT = 2;
const COMPLAINT_ALERT_THRESHOLD_PERCENT = 0.05;

type DeliveryRow = {
  delivery_status: string;
  kind: string;
  sent_at: string;
  last_provider_event_at: string | null;
};

type RecipientHealthRow = {
  is_suppressed: boolean;
  suppression_reason: string | null;
  soft_bounce_count: number;
  last_event_type: string | null;
  last_event_at: string | null;
  updated_at: string;
};

export type EmailHealthAlert = {
  key: "bounce_rate" | "complaint_rate";
  severity: "warning" | "critical";
  title: string;
  detail: string;
};

export type EmailHealthSnapshot = {
  windowDays: number;
  total: number;
  delivered: number;
  delayed: number;
  bounced: number;
  complained: number;
  failed: number;
  providerSuppressed: number;
  pending: number;
  deliveryRate: number | null;
  bounceRate: number | null;
  complaintRate: number | null;
  bounceAlertThreshold: number;
  complaintAlertThreshold: number;
  alerts: EmailHealthAlert[];
  activeSuppressions: number;
  providerUnsuppressed: number;
  suppressionsByReason: Record<string, number>;
  recentIssues: DeliveryRow[];
};

function percentage(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : null;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })}%`;
}

export function buildEmailHealthSnapshot(
  deliveries: DeliveryRow[],
  recipientHealth: RecipientHealthRow[],
  windowDays = 30
): EmailHealthSnapshot {
  const delivered = deliveries.filter((row) => row.delivery_status === "delivered").length;
  const delayed = deliveries.filter((row) => row.delivery_status === "delayed").length;
  const bounced = deliveries.filter((row) => row.delivery_status === "bounced").length;
  const complained = deliveries.filter((row) => row.delivery_status === "complained").length;
  const failed = deliveries.filter((row) => row.delivery_status === "failed").length;
  const providerSuppressed = deliveries.filter((row) => row.delivery_status === "suppressed").length;
  const pending = deliveries.filter((row) => row.delivery_status === "sent").length;
  const total = deliveries.length;
  const deliveryRate = percentage(delivered, total);
  const bounceRate = percentage(bounced, total);
  const complaintRate = percentage(complained, total);

  const activeRecipients = recipientHealth.filter((row) => row.is_suppressed);
  const providerUnsuppressed = recipientHealth.filter(
    (row) => !row.is_suppressed && row.last_event_type === "suppression.removed"
  ).length;

  const suppressionsByReason = activeRecipients.reduce<Record<string, number>>(
    (acc, row) => {
      const reason = row.suppression_reason || "unknown";
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    },
    {}
  );

  const alerts: EmailHealthAlert[] = [];

  if (bounceRate != null && bounceRate > BOUNCE_ALERT_THRESHOLD_PERCENT) {
    alerts.push({
      key: "bounce_rate",
      severity: "warning",
      title: "Tasa de rebote por encima del umbral",
      detail: `${formatPercent(bounceRate)} en ${total} envíos · objetivo ≤ ${formatPercent(
        BOUNCE_ALERT_THRESHOLD_PERCENT
      )}.`,
    });
  }

  if (complaintRate != null && complaintRate > COMPLAINT_ALERT_THRESHOLD_PERCENT) {
    alerts.push({
      key: "complaint_rate",
      severity: "critical",
      title: "Tasa de complaints por encima del umbral",
      detail: `${formatPercent(complaintRate)} en ${total} envíos · objetivo ≤ ${formatPercent(
        COMPLAINT_ALERT_THRESHOLD_PERCENT
      )}.`,
    });
  }

  return {
    windowDays,
    total,
    delivered,
    delayed,
    bounced,
    complained,
    failed,
    providerSuppressed,
    pending,
    deliveryRate,
    bounceRate,
    complaintRate,
    bounceAlertThreshold: BOUNCE_ALERT_THRESHOLD_PERCENT,
    complaintAlertThreshold: COMPLAINT_ALERT_THRESHOLD_PERCENT,
    alerts,
    activeSuppressions: activeRecipients.length,
    providerUnsuppressed,
    suppressionsByReason,
    recentIssues: deliveries
      .filter((row) =>
        ["delayed", "bounced", "complained", "failed", "suppressed"].includes(
          row.delivery_status
        )
      )
      .slice(0, 20),
  };
}

export async function loadEmailHealth(
  admin: SupabaseClient,
  windowDays = 30
): Promise<EmailHealthSnapshot> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const [deliveryResult, healthResult] = await Promise.all([
    admin
      .from("transactional_email_deliveries")
      .select("delivery_status,kind,sent_at,last_provider_event_at")
      .gte("sent_at", since)
      .order("sent_at", { ascending: false })
      .limit(5000)
      .returns<DeliveryRow[]>(),
    admin
      .from("transactional_email_recipient_health")
      .select(
        "is_suppressed,suppression_reason,soft_bounce_count,last_event_type,last_event_at,updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(5000)
      .returns<RecipientHealthRow[]>(),
  ]);

  if (deliveryResult.error) throw deliveryResult.error;
  if (healthResult.error) throw healthResult.error;

  return buildEmailHealthSnapshot(
    deliveryResult.data || [],
    healthResult.data || [],
    windowDays
  );
}
