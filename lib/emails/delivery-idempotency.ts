import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProviderSendResult = {
  skipped?: boolean;
  id?: string | null;
  [key: string]: unknown;
};

export type TransactionalEmailOnceResult =
  | {
      sent: true;
      alreadySent: boolean;
      providerMessageId: string | null;
    }
  | {
      sent: false;
      alreadySent: false;
      skipped: true;
      reason?: "provider_skipped" | "suppressed";
      suppressionReason?: string | null;
    };

export function normalizeRecipientEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashRecipientEmail(email: string) {
  return createHash("sha256").update(normalizeRecipientEmail(email)).digest("hex");
}

export async function sendTransactionalEmailOnce(
  supabase: SupabaseClient,
  params: {
    eventKey: string;
    userId?: string | null;
    recipientEmail?: string | null;
    kind: string;
    send: () => Promise<ProviderSendResult>;
  }
): Promise<TransactionalEmailOnceResult> {
  const eventKey = params.eventKey.trim();
  if (!eventKey) {
    throw new Error("Email event key is required.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("transactional_email_deliveries")
    .select("provider_message_id,sent_at")
    .eq("event_key", eventKey)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    return {
      sent: true,
      alreadySent: true,
      providerMessageId: existing.provider_message_id || null,
    };
  }

  const recipientEmailHash =
    typeof params.recipientEmail === "string" && params.recipientEmail.trim()
      ? hashRecipientEmail(params.recipientEmail)
      : null;

  if (recipientEmailHash) {
    const { data: health, error: healthError } = await supabase
      .from("transactional_email_recipient_health")
      .select("is_suppressed,suppression_reason")
      .eq("recipient_email_hash", recipientEmailHash)
      .maybeSingle();

    if (healthError) throw healthError;

    if (health?.is_suppressed) {
      return {
        sent: false,
        alreadySent: false,
        skipped: true,
        reason: "suppressed",
        suppressionReason: health.suppression_reason || null,
      };
    }
  }

  const providerResult = await params.send();
  if (providerResult.skipped === true) {
    return {
      sent: false,
      alreadySent: false,
      skipped: true,
      reason: "provider_skipped",
    };
  }

  const providerMessageId =
    typeof providerResult.id === "string" && providerResult.id.trim()
      ? providerResult.id.trim()
      : null;

  const { error: recordError } = await supabase
    .from("transactional_email_deliveries")
    .upsert(
      {
        event_key: eventKey,
        user_id: params.userId || null,
        recipient_email_hash: recipientEmailHash,
        kind: params.kind,
        provider: "resend",
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
      },
      { onConflict: "event_key", ignoreDuplicates: true }
    );

  if (recordError) throw recordError;

  return {
    sent: true,
    alreadySent: false,
    providerMessageId,
  };
}
