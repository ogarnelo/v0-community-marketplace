import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type DeliveryRow = {
  delivery_status: string;
  kind: string;
  sent_at: string;
  last_provider_event_at: string | null;
};

type RecipientHealthRow = {
  suppression_reason: string | null;
  soft_bounce_count: number;
  updated_at: string;
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
  activeSuppressions: number;
  suppressionsByReason: Record<string, number>;
  recentIssues: DeliveryRow[];
};

function percentage(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : null;
}

export function buildEmailHealthSnapshot(
  deliveries: DeliveryRow[],
  suppressedRecipients: RecipientHealthRow[],
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

  const suppressionsByReason = suppressedRecipients.reduce<Record<string, number>>(
    (acc, row) => {
      const reason = row.suppression_reason || "unknown";
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    },
    {}
  );

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
    deliveryRate: percentage(delivered, total),
    bounceRate: percentage(bounced, total),
    complaintRate: percentage(complained, total),
    activeSuppressions: suppressedRecipients.length,
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

  const [deliveryResult, suppressionResult] = await Promise.all([
    admin
      .from("transactional_email_deliveries")
      .select("delivery_status,kind,sent_at,last_provider_event_at")
      .gte("sent_at", since)
      .order("sent_at", { ascending: false })
      .limit(5000)
      .returns<DeliveryRow[]>(),
    admin
      .from("transactional_email_recipient_health")
      .select("suppression_reason,soft_bounce_count,updated_at")
      .eq("is_suppressed", true)
      .order("updated_at", { ascending: false })
      .limit(5000)
      .returns<RecipientHealthRow[]>(),
  ]);

  if (deliveryResult.error) throw deliveryResult.error;
  if (suppressionResult.error) throw suppressionResult.error;

  return buildEmailHealthSnapshot(
    deliveryResult.data || [],
    suppressionResult.data || [],
    windowDays
  );
}
