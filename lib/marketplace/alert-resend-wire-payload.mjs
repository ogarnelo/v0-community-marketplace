/**
 * Isolated preparation of the EXACT JSON bytes used by the current
 * sendBrandedEmail() Resend request. No network calls, credentials or PII
 * are persisted. The frozen string is passed to the send-intent adapter.
 *
 * This is NOT used by the live email route while the pilot worker is gated.
 */
export function prepareResendWirePayload({ from, to, subject, html, text, attachments }) {
  if ([from, to, subject, html, text].some(v => typeof v !== "string" || !v.trim())) {
    throw new TypeError("Complete Resend payload required");
  }
  if (attachments !== undefined && !Array.isArray(attachments)) {
    throw new TypeError("Invalid attachments");
  }
  const requestBody = JSON.stringify({
    from,
    to: [to],
    subject,
    html,
    text,
    attachments: attachments?.map(attachment => ({
      filename: attachment.filename,
      content: attachment.content,
      content_type: attachment.contentType,
    })),
  });
  return requestBody;
}

/**
 * Fully injected transport: cannot re-render HTML, re-read listing data, or
 * change bytes after intent reservation. Never call this from a browser.
 * Does not log response bodies or private recipient data.
 */
export async function sendPreparedResendPayload({
  requestBody, eventKey, apiKey, fetchImpl,
}) {
  if (typeof requestBody !== "string" || !requestBody.length ||
      typeof eventKey !== "string" || !eventKey.startsWith("saved-search-match/") ||
      typeof apiKey !== "string" || !apiKey.trim() ||
      typeof fetchImpl !== "function") {
    throw new TypeError("Invalid internal Resend transport");
  }
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": eventKey,
    },
    body: requestBody,
  });
  if (!response.ok) throw new Error("resend_delivery_failure");
  const receipt = await response.json();
  if (typeof receipt?.id !== "string" || !receipt.id.trim()) {
    throw new Error("resend_receipt_missing");
  }
  return { id: receipt.id };
}
