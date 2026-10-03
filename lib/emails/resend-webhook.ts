import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

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

  const deliveryStatus = DELIVERY_STATUS_BY_EVENT[eventType];
  if (deliveryStatus && providerMessageId) {
    const { data: delivery, error: deliveryError } = await supabase
      .from("transactional_email_deliveries")
      .select("id,last_provider_event_at")
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
