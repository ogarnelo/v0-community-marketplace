import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSavedSearchMatchEmail } from "@/lib/emails/saved-search-match-email";
import { getEmailFrom } from "@/lib/emails/brand";
import { hashRecipientEmail } from "@/lib/emails/delivery-idempotency";
import { deliverPreparedMarketplaceAlert } from "@/lib/marketplace/alert-email-intent-composition.mjs";

/**
 * Only for a separately enabled, signed recovery worker. Never called by the
 * normal seller-publishing path. This is deliberately fail-closed if the new
 * intent SQL has not been applied or a provider outcome is uncertain.
 */
export async function sendGatedMarketplaceAlertWithIntent(
  admin: SupabaseClient,
  input: {
    eventKey: string;
    userId: string;
    recipientEmail: string;
    listingId: string;
    listingTitle: string;
  }
): Promise<{sent: boolean; reason?: "suppressed" | "provider_skipped" | "requires_reconciliation"}> {
  const {data: legacy, error: legacyError} = await admin
    .from("transactional_email_deliveries")
    .select("sent_at,provider_message_id")
    .eq("event_key", input.eventKey).maybeSingle();
  if (legacyError) throw new Error("legacy_receipt_lookup_failed");
  if (legacy) return {sent:true};

  const recipientHash = hashRecipientEmail(input.recipientEmail);
  const {data: health, error: healthError} = await admin
    .from("transactional_email_recipient_health")
    .select("is_suppressed")
    .eq("recipient_email_hash", recipientHash).maybeSingle();
  if (healthError) throw new Error("recipient_health_lookup_failed");
  if (health?.is_suppressed) return {sent:false,reason:"suppressed"};

  const apiKey=process.env.RESEND_API_KEY;
  const from=getEmailFrom();
  if (!apiKey || !from) return {sent:false,reason:"provider_skipped"};

  const built=buildSavedSearchMatchEmail({
    to:input.recipientEmail,listingId:input.listingId,
    listingTitle:input.listingTitle,idempotencyKey:input.eventKey,
  });
  const result=await deliverPreparedMarketplaceAlert({
    db:admin,eventKey:input.eventKey,
    message:{
      from,to:built.to,subject:built.subject,
      html:built.html,text:built.text,
    },
    apiKey,fetchImpl:fetch,
  });

  // No 'emailed_at' marker is allowed on ambiguous outcomes, missing intent
  // tables, conflicting payloads or provider failures. Caller must schedule
  // or surface reconciliation; it must NOT declare delivery completed.
  if (result.status!=="accepted" && result.status!=="already_accepted") {
    return {sent:false,reason:"requires_reconciliation"};
  }

  // Bridge the new durable intent to the prior receipt mechanism so a later
  // non-worker invocation will not initiate a second provider request.
  const {error: receiptError}=await admin.from("transactional_email_deliveries")
    .upsert({
      event_key:input.eventKey,
      user_id:input.userId,
      recipient_email_hash:recipientHash,
      kind:"saved_search_match",
      provider:"resend",
      provider_message_id:result.providerMessageId || null,
      sent_at:new Date().toISOString(),
    },{onConflict:"event_key",ignoreDuplicates:true});
  if (receiptError) throw new Error("receipt_bridge_failed");
  return {sent:true};
}
