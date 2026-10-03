import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashRecipientEmail } from "@/lib/emails/delivery-idempotency";

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const SOFT_BOUNCE_SUPPRESSION_THRESHOLD = 3;

const DELIVERY_STATUS_BY_EVENT: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "suppressed",
};

const TIMESTAMP_COLUMN_BY_EVENT: Record<string, string> = {
  "email.delivered": "delivered_at",
  "email.delivery_delayed": "delivery_delayed_at",
  "email.bounced": "bounced_at",
  "email.complained": "complained_at",
  "email.failed": "failed_at",
  "email.suppressed": "suppressed_at",
};

export type ResendWebhookEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    message_id?: string;
    email?: string;
    origin?: string;
    source_id?: string | null;
    suppression?: {
      email?: string;
      origin?: string;
      source_id?: string | null;
      [key: string]: unknown;
    };
    to?: string[];
    bounce?: {
      type?: string;
      subType?: string;
      message?: string;
      [key: string]: unknown;
    };
    bounce_type?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function getHeader(headers: Headers, primary: string, legacy: string) {
  return headers.get(primary) || headers.get(legacy);
}

function decodeSigningKey(secret: string) {
  const trimmed = secret.trim();
  const encoded = trimmed.startsWith("whsec_") ? trimmed.slice("whsec_".length) : trimmed;
  if (!encoded) throw new Error("Webhook signing secret is empty.");
  return Buffer.from(encoded, "base64");
}

function matchesAnySignature(signatureHeader: string, expected: Buffer) {
  return signatureHeader
    .split(/\s+/)
    .filter(Boolean)
    .some((entry) => {
      const [version, encoded] = entry.split(",", 2);
      if (version !== "v1" || !encoded) return false;

      let actual: Buffer;
      try {
        actual = Buffer.from(encoded, "base64");
      } catch {
        return false;
      }

      return actual.length === expected.length && timingSafeEqual(actual, expected);
    });
}

export function verifyResendWebhookSignature(params: {
  rawBody: string;
  headers: Headers;
  signingSecrets: string[];
  nowSeconds?: number;
}) {
  const messageId = getHeader(params.headers, "svix-id", "webhook-id");
  const timestamp = getHeader(params.headers, "svix-timestamp", "webhook-timestamp");
  const signature = getHeader(params.headers, "svix-signature", "webhook-signature");

  if (!messageId || !timestamp || !signature) {
    throw new Error("Missing webhook signature headers.");
  }

  const timestampSeconds = Number(timestamp);
  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (!Number.isInteger(timestampSeconds)) {
    throw new Error("Invalid webhook timestamp.");
  }

  if (Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) {
    throw new Error("Webhook timestamp outside allowed tolerance.");
  }

  const signedContent = `${messageId}.${timestamp}.${params.rawBody}`;
  const valid = params.signingSecrets.some((secret) => {
    const expected = createHmac("sha256", decodeSigningKey(secret))
      .update(signedContent)
      .digest();
    return matchesAnySignature(signature, expected);
  });

  if (!valid) {
    throw new Error("Invalid webhook signature.");
  }

  return { messageId, timestampSeconds };
}

function normalizeEventTime(event: ResendWebhookEvent) {
  const candidate =
    typeof event.created_at === "string" && event.created_at.trim()
      ? event.created_at.trim()
      : null;

  if (!candidate) return new Date().toISOString();

  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function normalizeBounceType(event: ResendWebhookEvent) {
  const raw =
    (typeof event.data?.bounce?.type === "string" && event.data.bounce.type) ||
    (typeof event.data?.bounce_type === "string" && event.data.bounce_type) ||
    "";

  const normalized = raw.trim().toLowerCase();
  if (normalized === "permanent" || normalized.includes("hard")) return "hard";
  if (normalized === "transient" || normalized.includes("soft")) return "soft";
  return "undetermined";
}

function suppressionLifecycleData(event: ResendWebhookEvent) {
  const data = event.data || {};
  const suppression =
    data.suppression && typeof data.suppression === "object"
      ? data.suppression
      : undefined;

  const emailCandidates = [
    typeof data.email === "string" ? data.email : "",
    typeof suppression?.email === "string" ? suppression.email : "",
    Array.isArray(data.to) && typeof data.to[0] === "string" ? data.to[0] : "",
  ];
  const email = emailCandidates.map((value) => value.trim()).find(Boolean) || "";

  const originCandidates = [
    typeof data.origin === "string" ? data.origin : "",
    typeof suppression?.origin === "string" ? suppression.origin : "",
  ];
  const origin =
    originCandidates.map((value) => value.trim().toLowerCase()).find(Boolean) || "manual";

  const sourceIdCandidates = [
    typeof data.source_id === "string" ? data.source_id : "",
    typeof suppression?.source_id === "string" ? suppression.source_id : "",
  ];
  const sourceId = sourceIdCandidates.map((value) => value.trim()).find(Boolean) || null;

  return { email, origin, sourceId };
}

function suppressionReasonFromOrigin(
  origin: string
): "hard_bounce" | "complaint" | "provider_suppressed" {
  if (origin === "bounce") return "hard_bounce";
  if (origin === "complaint") return "complaint";
  return "provider_suppressed";
}

async function syncProviderSuppressionLifecycle(
  supabase: SupabaseClient,
  params: {
    eventId: string;
    eventType: "suppression.added" | "suppression.removed";
    eventAt: string;
    email: string;
    origin: string;
    sourceId: string | null;
  }
) {
  const recipientEmailHash = hashRecipientEmail(params.email);

  if (params.eventType === "suppression.added") {
    const { error } = await supabase
      .from("transactional_email_recipient_health")
      .upsert(
        {
          recipient_email_hash: recipientEmailHash,
          is_suppressed: true,
          suppression_reason: suppressionReasonFromOrigin(params.origin),
          source_event_id: params.eventId,
          source_provider_message_id: params.sourceId,
          last_event_type: params.eventType,
          last_event_at: params.eventAt,
          suppressed_at: params.eventAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "recipient_email_hash" }
      );

    if (error) throw error;
    return "suppression_added";
  }

  const { data: current, error: currentError } = await supabase
    .from("transactional_email_recipient_health")
    .select("recipient_email_hash")
    .eq("recipient_email_hash", recipientEmailHash)
    .maybeSingle();

  if (currentError) throw currentError;

  if (current) {
    const { error } = await supabase
      .from("transactional_email_recipient_health")
      .update({
        soft_bounce_count: 0,
        is_suppressed: false,
        suppression_reason: null,
        source_event_id: params.eventId,
        source_provider_message_id: params.sourceId,
        last_event_type: params.eventType,
        last_event_at: params.eventAt,
        suppressed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("recipient_email_hash", recipientEmailHash);

    if (error) throw error;
  }

  return "suppression_removed";
}

async function upsertImmediateSuppression(
  supabase: SupabaseClient,
  params: {
    recipientEmailHash: string;
    userId?: string | null;
    reason: "hard_bounce" | "complaint" | "provider_suppressed";
    eventId: string;
    providerMessageId: string;
    eventType: string;
    eventAt: string;
  }
) {
  const { error } = await supabase
    .from("transactional_email_recipient_health")
    .upsert(
      {
        recipient_email_hash: params.recipientEmailHash,
        user_id: params.userId || null,
        is_suppressed: true,
        suppression_reason: params.reason,
        source_event_id: params.eventId,
        source_provider_message_id: params.providerMessageId,
        last_event_type: params.eventType,
        last_event_at: params.eventAt,
        suppressed_at: params.eventAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "recipient_email_hash" }
    );

  if (error) throw error;
}

async function recordBounceHealth(
  supabase: SupabaseClient,
  params: {
    recipientEmailHash: string;
    userId?: string | null;
    eventId: string;
    providerMessageId: string;
    eventAt: string;
    bounceType: "hard" | "soft" | "undetermined";
  }
) {
  if (params.bounceType === "hard") {
    await upsertImmediateSuppression(supabase, {
      recipientEmailHash: params.recipientEmailHash,
      userId: params.userId,
      reason: "hard_bounce",
      eventId: params.eventId,
      providerMessageId: params.providerMessageId,
      eventType: "email.bounced",
      eventAt: params.eventAt,
    });
    return;
  }

  const { data: current, error: currentError } = await supabase
    .from("transactional_email_recipient_health")
    .select("soft_bounce_count,is_suppressed,suppression_reason,suppressed_at")
    .eq("recipient_email_hash", params.recipientEmailHash)
    .maybeSingle();

  if (currentError) throw currentError;

  const softBounceCount = Number(current?.soft_bounce_count || 0) + 1;
  const shouldSuppress =
    Boolean(current?.is_suppressed) ||
    softBounceCount >= SOFT_BOUNCE_SUPPRESSION_THRESHOLD;

  const { error } = await supabase
    .from("transactional_email_recipient_health")
    .upsert(
      {
        recipient_email_hash: params.recipientEmailHash,
        user_id: params.userId || null,
        soft_bounce_count: softBounceCount,
        is_suppressed: shouldSuppress,
        suppression_reason: current?.is_suppressed
          ? current.suppression_reason
          : shouldSuppress
            ? "soft_bounce_limit"
            : null,
        source_event_id: shouldSuppress ? params.eventId : null,
        source_provider_message_id: shouldSuppress ? params.providerMessageId : null,
        last_event_type: "email.bounced",
        last_event_at: params.eventAt,
        suppressed_at: current?.suppressed_at || (shouldSuppress ? params.eventAt : null),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "recipient_email_hash" }
    );

  if (error) throw error;
}

async function resetTransientBounceCountAfterDelivery(
  supabase: SupabaseClient,
  params: {
    recipientEmailHash: string;
    eventAt: string;
  }
) {
  const { data: current, error: currentError } = await supabase
    .from("transactional_email_recipient_health")
    .select("is_suppressed")
    .eq("recipient_email_hash", params.recipientEmailHash)
    .maybeSingle();

  if (currentError) throw currentError;
  if (!current || current.is_suppressed) return;

  const { error } = await supabase
    .from("transactional_email_recipient_health")
    .update({
      soft_bounce_count: 0,
      last_event_type: "email.delivered",
      last_event_at: params.eventAt,
      updated_at: new Date().toISOString(),
    })
    .eq("recipient_email_hash", params.recipientEmailHash);

  if (error) throw error;
}

export async function loadActiveResendWebhookSecrets(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("resend_webhook_secrets")
    .select("signing_secret")
    .eq("is_active", true)
    .is("retired_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || [])
    .map((row) => (typeof row.signing_secret === "string" ? row.signing_secret.trim() : ""))
    .filter(Boolean);
}

export async function processResendWebhookEvent(
  supabase: SupabaseClient,
  params: {
    eventId: string;
    event: ResendWebhookEvent;
  }
) {
  const eventType = typeof params.event.type === "string" ? params.event.type.trim() : "";
  const providerMessageId =
    typeof params.event.data?.email_id === "string"
      ? params.event.data.email_id.trim()
      : "";
  const providerEventAt = normalizeEventTime(params.event);

  const { data: existingEvent, error: existingEventError } = await supabase
    .from("resend_webhook_events")
    .select("event_id,processed_at,processing_result")
    .eq("event_id", params.eventId)
    .maybeSingle();

  if (existingEventError) throw existingEventError;
  if (existingEvent?.processed_at) {
    return {
      duplicate: true,
      processingResult: existingEvent.processing_result || "processed",
      matchedDelivery: existingEvent.processing_result === "matched_delivery",
    };
  }

  const { error: eventUpsertError } = await supabase
    .from("resend_webhook_events")
    .upsert(
      {
        event_id: params.eventId,
        event_type: eventType || "unknown",
        provider_message_id: providerMessageId || null,
        event_created_at: providerEventAt,
      },
      { onConflict: "event_id" }
    );

  if (eventUpsertError) throw eventUpsertError;

  let processingResult = "ignored_event";
  let matchedDelivery = false;

  if (eventType === "suppression.added" || eventType === "suppression.removed") {
    const lifecycle = suppressionLifecycleData(params.event);
    if (lifecycle.email) {
      processingResult = await syncProviderSuppressionLifecycle(supabase, {
        eventId: params.eventId,
        eventType,
        eventAt: providerEventAt,
        email: lifecycle.email,
        origin: lifecycle.origin,
        sourceId: lifecycle.sourceId,
      });
    } else {
      processingResult = "suppression_missing_email";
    }
  }

  const deliveryStatus = DELIVERY_STATUS_BY_EVENT[eventType];
  if (deliveryStatus && providerMessageId) {
    const { data: delivery, error: deliveryError } = await supabase
      .from("transactional_email_deliveries")
      .select("id,user_id,recipient_email_hash,last_provider_event_at")
      .eq("provider", "resend")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();

    if (deliveryError) throw deliveryError;

    if (delivery) {
      const existingEventAt =
        typeof delivery.last_provider_event_at === "string"
          ? new Date(delivery.last_provider_event_at).getTime()
          : Number.NEGATIVE_INFINITY;
      const incomingEventAt = new Date(providerEventAt).getTime();

      const update: Record<string, string> = {};
      const timestampColumn = TIMESTAMP_COLUMN_BY_EVENT[eventType];
      if (timestampColumn) update[timestampColumn] = providerEventAt;

      if (incomingEventAt >= existingEventAt) {
        update.delivery_status = deliveryStatus;
        update.last_provider_event_type = eventType;
        update.last_provider_event_at = providerEventAt;
      }

      if (Object.keys(update).length > 0) {
        const { error: updateError } = await supabase
          .from("transactional_email_deliveries")
          .update(update)
          .eq("id", delivery.id);

        if (updateError) throw updateError;
      }

      if (delivery.recipient_email_hash) {
        if (eventType === "email.complained") {
          await upsertImmediateSuppression(supabase, {
            recipientEmailHash: delivery.recipient_email_hash,
            userId: delivery.user_id,
            reason: "complaint",
            eventId: params.eventId,
            providerMessageId,
            eventType,
            eventAt: providerEventAt,
          });
        } else if (eventType === "email.suppressed") {
          await upsertImmediateSuppression(supabase, {
            recipientEmailHash: delivery.recipient_email_hash,
            userId: delivery.user_id,
            reason: "provider_suppressed",
            eventId: params.eventId,
            providerMessageId,
            eventType,
            eventAt: providerEventAt,
          });
        } else if (eventType === "email.bounced") {
          await recordBounceHealth(supabase, {
            recipientEmailHash: delivery.recipient_email_hash,
            userId: delivery.user_id,
            eventId: params.eventId,
            providerMessageId,
            eventAt: providerEventAt,
            bounceType: normalizeBounceType(params.event),
          });
        } else if (eventType === "email.delivered") {
          await resetTransientBounceCountAfterDelivery(supabase, {
            recipientEmailHash: delivery.recipient_email_hash,
            eventAt: providerEventAt,
          });
        }
      }

      processingResult = "matched_delivery";
      matchedDelivery = true;
    } else {
      processingResult = "unmatched_delivery";
    }
  }

  const { error: processedError } = await supabase
    .from("resend_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      processing_result: processingResult,
    })
    .eq("event_id", params.eventId);

  if (processedError) throw processedError;

  return {
    duplicate: false,
    processingResult,
    matchedDelivery,
  };
}
