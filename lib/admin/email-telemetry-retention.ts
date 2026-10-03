import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const EMAIL_TELEMETRY_RETENTION_DAYS = 90;
const DELETE_BATCH_SIZE = 250;
const MAX_BATCHES_PER_RUN = 20;

type EventIdRow = {
  event_id: string;
};

export type EmailTelemetryRetentionResult = {
  retentionDays: number;
  cutoff: string;
  deleted: number;
  batchLimitReached: boolean;
};

export async function pruneEmailTelemetry(
  admin: SupabaseClient,
  options: {
    now?: Date;
    retentionDays?: number;
  } = {}
): Promise<EmailTelemetryRetentionResult> {
  const now = options.now || new Date();
  const retentionDays = options.retentionDays ?? EMAIL_TELEMETRY_RETENTION_DAYS;

  if (!Number.isInteger(retentionDays) || retentionDays < 30) {
    throw new Error("Email telemetry retention must be at least 30 days.");
  }

  const cutoff = new Date(
    now.getTime() - retentionDays * 24 * 60 * 60 * 1000
  ).toISOString();

  let deleted = 0;
  let batchLimitReached = false;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
    const { data: candidates, error: candidateError } = await admin
      .from("resend_webhook_events")
      .select("event_id")
      .not("processed_at", "is", null)
      .lt("received_at", cutoff)
      .order("received_at", { ascending: true })
      .limit(DELETE_BATCH_SIZE)
      .returns<EventIdRow[]>();

    if (candidateError) throw candidateError;

    const eventIds = (candidates || [])
      .map((row) => row.event_id)
      .filter(Boolean);

    if (eventIds.length === 0) {
      return {
        retentionDays,
        cutoff,
        deleted,
        batchLimitReached: false,
      };
    }

    const { error: deleteError } = await admin
      .from("resend_webhook_events")
      .delete()
      .in("event_id", eventIds);

    if (deleteError) throw deleteError;

    deleted += eventIds.length;

    if (eventIds.length < DELETE_BATCH_SIZE) {
      return {
        retentionDays,
        cutoff,
        deleted,
        batchLimitReached: false,
      };
    }
  }

  batchLimitReached = true;

  return {
    retentionDays,
    cutoff,
    deleted,
    batchLimitReached,
  };
}
