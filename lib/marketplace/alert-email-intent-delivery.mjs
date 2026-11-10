// Isolated pilot adapter: deliberately NOT imported by any email route.
// The caller MUST provide the exact serialized Resend request body as a string.
// It is hashed but never persisted. A mutable payload fails closed on retries.
// No automatic resend after crossing the 'sending' boundary.
import { createHash } from "node:crypto";

export const hashProviderPayload = (requestBody) => {
  if (typeof requestBody !== "string" || !requestBody.length) {
    throw new TypeError("Exact serialized email payload required");
  }
  return createHash("sha256").update(requestBody, "utf8").digest("hex");
};

/**
 * Safe transaction-independent adapter to test the end-to-end intent state
 * machine without credentials. The send callback must use EXACTLY the same
 * requestBody and eventKey, not re-render mutable listing or recipient data.
 *
 * @param {{rpc:Function}} db service-role client; never a browser client
 * @param {{eventKey:string,requestBody:string,send:Function}} input
 * @returns {Promise<{status:string,providerMessageId?:string}>}
 */
export async function deliverWithIntent(db, { eventKey, requestBody, send }) {
  if (!db || typeof db.rpc !== "function" || typeof db.from !== "function" ||
      typeof send !== "function" ||
      typeof eventKey !== "string" || !eventKey.startsWith("saved-search-match/") ||
      eventKey.length > 200) {
    throw new TypeError("Invalid internal alert intent invocation");
  }
  // Historical send receipts predate the intent table. Checking them first
  // avoids retransmitting emails recorded by the previous delivery mechanism.
  // Fail closed on query errors: do not begin a new provider attempt.
  const legacy = await db.from("transactional_email_deliveries")
    .select("provider_message_id,sent_at")
    .eq("event_key", eventKey)
    .maybeSingle();
  if (legacy.error) throw new Error("legacy_receipt_lookup_failed");
  if (legacy.data) return { status: "already_accepted" };

  const payloadHash = hashProviderPayload(requestBody);
  const prepare = await db.rpc("marketplace_alert_email_prepare_v1", {
    p_event_key: eventKey, p_payload_sha256: payloadHash,
  });
  if (prepare.error) throw new Error("intent_prepare_failed");
  if (!Array.isArray(prepare.data) || prepare.data.length !== 1) {
    throw new Error("intent_prepare_invalid_response");
  }
  const record = prepare.data[0];
  if (record.outcome === "accepted") return { status: "already_accepted" };
  if (record.outcome === "sending" || record.outcome === "ambiguous" ||
      record.outcome === "payload_conflict") {
    return { status: record.outcome === "payload_conflict" ? "payload_conflict" : "requires_reconciliation" };
  }
  if (record.outcome !== "prepared" || typeof record.intent_token !== "string") {
    throw new Error("intent_prepare_invalid_state");
  }
  const token = record.intent_token;
  const begun = await db.rpc("marketplace_alert_email_begin_v1", {
    p_event_key: eventKey, p_payload_sha256: payloadHash, p_token: token,
  });
  if (begun.error) throw new Error("intent_begin_failed");
  if (begun.data !== true) return { status: "requires_reconciliation" };

  // Once begun=true has committed, all failures are ambiguous. The provider
  // may have accepted a request even if the response is absent.
  try {
    const provider = await send({ eventKey, requestBody });
    if (provider?.skipped === true) {
      await db.rpc("marketplace_alert_email_ambiguous_v1", {
        p_event_key: eventKey, p_token: token,
      });
      return { status: "requires_reconciliation" };
    }
    if (typeof provider?.id !== "string" || !provider.id.trim()) {
      await db.rpc("marketplace_alert_email_ambiguous_v1", {
        p_event_key: eventKey, p_token: token,
      });
      return { status: "requires_reconciliation" };
    }
    const accepted = await db.rpc("marketplace_alert_email_accept_v1", {
      p_event_key: eventKey, p_token: token, p_provider_message_id: provider.id,
    });
    if (accepted.error || accepted.data !== true) {
      // The 'sending' DB state is durable and must not be retried.
      return { status: "requires_reconciliation" };
    }
    return { status: "accepted", providerMessageId: provider.id };
  } catch {
    // Intentionally do not log the provider error, recipient or request body.
    // If this RPC fails, 'sending' remains quarantined just as safely.
    await db.rpc("marketplace_alert_email_ambiguous_v1", {
      p_event_key: eventKey, p_token: token,
    }).catch(() => undefined);
    return { status: "requires_reconciliation" };
  }
}
