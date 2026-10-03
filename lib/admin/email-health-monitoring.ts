import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotificationOnce } from "@/lib/notifications";
import {
  loadEmailHealth,
  type EmailHealthSnapshot,
} from "@/lib/admin/email-health";

export type EmailHealthMetric = "bounce_rate" | "complaint_rate";

export type EmailHealthAlertState = {
  metric: EmailHealthMetric;
  threshold_percent: number;
  is_active: boolean;
  generation: number;
  last_value_percent: number | null;
  crossed_at: string | null;
  recovered_at: string | null;
  last_evaluated_at: string;
};

export type EmailHealthDailySnapshotRow = {
  snapshot_date: string;
  window_days: number;
  total: number;
  delivered: number;
  bounced: number;
  complained: number;
  failed: number;
  delivery_rate: number | null;
  bounce_rate: number | null;
  complaint_rate: number | null;
  active_suppressions: number;
  alert_keys: string[];
  updated_at: string;
};

export type EmailHealthTransition = {
  metric: EmailHealthMetric;
  type: "crossed" | "recovered";
  generation: number;
  valuePercent: number | null;
  thresholdPercent: number;
};

function snapshotDateForMadrid(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })}%`;
}

function metricValue(snapshot: EmailHealthSnapshot, metric: EmailHealthMetric) {
  return metric === "bounce_rate" ? snapshot.bounceRate : snapshot.complaintRate;
}

function metricThreshold(snapshot: EmailHealthSnapshot, metric: EmailHealthMetric) {
  return metric === "bounce_rate"
    ? snapshot.bounceAlertThreshold
    : snapshot.complaintAlertThreshold;
}

function metricTitle(metric: EmailHealthMetric) {
  return metric === "bounce_rate"
    ? "Alerta de entregabilidad: rebotes"
    : "Alerta crítica de email: complaints";
}

function metricBody(metric: EmailHealthMetric, value: number, threshold: number) {
  const label = metric === "bounce_rate" ? "La tasa de rebote" : "La tasa de complaints";
  return `${label} ha subido a ${formatPercent(value)}, por encima del umbral de ${formatPercent(
    threshold
  )}. Revisa Salud email.`;
}

async function notifySuperAdmins(
  admin: SupabaseClient,
  params: {
    metric: EmailHealthMetric;
    generation: number;
    valuePercent: number;
    thresholdPercent: number;
    snapshotDate: string;
  }
) {
  const { data: roles, error: rolesError } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin");

  if (rolesError) throw rolesError;

  const userIds = [
    ...new Set(
      (roles || [])
        .map((row) => (typeof row.user_id === "string" ? row.user_id : ""))
        .filter(Boolean)
    ),
  ];

  for (const userId of userIds) {
    const result = await createNotificationOnce(admin, {
      event_key: `email-health-alert/${params.metric}/${params.generation}/${userId}`,
      user_id: userId,
      kind: "email_health_alert",
      title: metricTitle(params.metric),
      body: metricBody(
        params.metric,
        params.valuePercent,
        params.thresholdPercent
      ),
      href: "/admin/super/email-health",
      metadata: {
        metric: params.metric,
        generation: params.generation,
        value_percent: params.valuePercent,
        threshold_percent: params.thresholdPercent,
        snapshot_date: params.snapshotDate,
      },
    });

    if (result.error) throw result.error;
  }

  return userIds.length;
}

async function persistDailySnapshot(
  admin: SupabaseClient,
  health: EmailHealthSnapshot,
  now: Date
) {
  const snapshotDate = snapshotDateForMadrid(now);
  const nowIso = now.toISOString();

  const { error } = await admin
    .from("transactional_email_health_daily_snapshots")
    .upsert(
      {
        snapshot_date: snapshotDate,
        window_days: health.windowDays,
        total: health.total,
        delivered: health.delivered,
        delayed: health.delayed,
        bounced: health.bounced,
        complained: health.complained,
        failed: health.failed,
        provider_suppressed: health.providerSuppressed,
        pending: health.pending,
        delivery_rate: health.deliveryRate,
        bounce_rate: health.bounceRate,
        complaint_rate: health.complaintRate,
        active_suppressions: health.activeSuppressions,
        provider_unsuppressed: health.providerUnsuppressed,
        alert_keys: health.alerts.map((alert) => alert.key),
        updated_at: nowIso,
      },
      { onConflict: "snapshot_date" }
    );

  if (error) throw error;
  return snapshotDate;
}

async function evaluateAlertStates(
  admin: SupabaseClient,
  health: EmailHealthSnapshot,
  snapshotDate: string,
  now: Date
) {
  const metrics: EmailHealthMetric[] = ["bounce_rate", "complaint_rate"];
  const { data: rows, error } = await admin
    .from("transactional_email_health_alert_states")
    .select(
      "metric,threshold_percent,is_active,generation,last_value_percent,crossed_at,recovered_at,last_evaluated_at"
    )
    .in("metric", metrics)
    .returns<EmailHealthAlertState[]>();

  if (error) throw error;

  const stateByMetric = new Map((rows || []).map((row) => [row.metric, row]));
  const nowIso = now.toISOString();
  const transitions: EmailHealthTransition[] = [];

  for (const metric of metrics) {
    const current = stateByMetric.get(metric);
    const value = metricValue(health, metric);
    const threshold = metricThreshold(health, metric);
    const nextActive = value != null && value > threshold;
    const wasActive = Boolean(current?.is_active);
    const generation = Number(current?.generation || 0);

    if (nextActive && !wasActive && value != null) {
      const nextGeneration = generation + 1;

      await notifySuperAdmins(admin, {
        metric,
        generation: nextGeneration,
        valuePercent: value,
        thresholdPercent: threshold,
        snapshotDate,
      });

      const { error: upsertError } = await admin
        .from("transactional_email_health_alert_states")
        .upsert(
          {
            metric,
            threshold_percent: threshold,
            is_active: true,
            generation: nextGeneration,
            last_value_percent: value,
            crossed_at: nowIso,
            recovered_at: current?.recovered_at || null,
            last_evaluated_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: "metric" }
        );

      if (upsertError) throw upsertError;

      transitions.push({
        metric,
        type: "crossed",
        generation: nextGeneration,
        valuePercent: value,
        thresholdPercent: threshold,
      });
      continue;
    }

    if (!nextActive && wasActive) {
      const { error: recoverError } = await admin
        .from("transactional_email_health_alert_states")
        .upsert(
          {
            metric,
            threshold_percent: threshold,
            is_active: false,
            generation,
            last_value_percent: value,
            crossed_at: current?.crossed_at || null,
            recovered_at: nowIso,
            last_evaluated_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: "metric" }
        );

      if (recoverError) throw recoverError;

      transitions.push({
        metric,
        type: "recovered",
        generation,
        valuePercent: value,
        thresholdPercent: threshold,
      });
      continue;
    }

    const { error: steadyError } = await admin
      .from("transactional_email_health_alert_states")
      .upsert(
        {
          metric,
          threshold_percent: threshold,
          is_active: nextActive,
          generation,
          last_value_percent: value,
          crossed_at: current?.crossed_at || null,
          recovered_at: current?.recovered_at || null,
          last_evaluated_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "metric" }
      );

    if (steadyError) throw steadyError;
  }

  return transitions;
}

export async function refreshEmailHealthMonitoring(
  admin: SupabaseClient,
  options: {
    now?: Date;
    windowDays?: number;
  } = {}
) {
  const now = options.now || new Date();
  const health = await loadEmailHealth(admin, options.windowDays || 30);
  const snapshotDate = await persistDailySnapshot(admin, health, now);
  const transitions = await evaluateAlertStates(
    admin,
    health,
    snapshotDate,
    now
  );

  return {
    snapshotDate,
    health,
    transitions,
  };
}

export async function loadEmailHealthHistory(
  admin: SupabaseClient,
  limit = 14
) {
  const { data, error } = await admin
    .from("transactional_email_health_daily_snapshots")
    .select(
      "snapshot_date,window_days,total,delivered,bounced,complained,failed,delivery_rate,bounce_rate,complaint_rate,active_suppressions,alert_keys,updated_at"
    )
    .order("snapshot_date", { ascending: false })
    .limit(limit)
    .returns<EmailHealthDailySnapshotRow[]>();

  if (error) throw error;
  return data || [];
}

export async function loadEmailHealthAlertStates(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("transactional_email_health_alert_states")
    .select(
      "metric,threshold_percent,is_active,generation,last_value_percent,crossed_at,recovered_at,last_evaluated_at"
    )
    .order("metric")
    .returns<EmailHealthAlertState[]>();

  if (error) throw error;
  return data || [];
}
