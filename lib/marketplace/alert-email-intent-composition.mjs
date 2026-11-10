// Internal-only pilot composition, unused by production routes.
// Couples the exact serialized Resend request bytes to the immutable intent
// fingerprint AND to the provider transport. Never render twice.
import { deliverWithIntent } from "./alert-email-intent-delivery.mjs";
import { prepareResendWirePayload, sendPreparedResendPayload } from "./alert-resend-wire-payload.mjs";

export async function deliverPreparedMarketplaceAlert({
  db, eventKey, message, apiKey, fetchImpl,
}) {
  if (!db || !message || typeof message !== "object" ||
      typeof fetchImpl !== "function" || typeof apiKey !== "string" || !apiKey.trim()) {
    throw new TypeError("Internal marketplace alert delivery requires a server-only client");
  }

  const requestBody = prepareResendWirePayload(message);
  return deliverWithIntent(db, {
    eventKey,
    requestBody,
    send: ({ eventKey: reservedKey, requestBody: reservedBytes }) =>
      sendPreparedResendPayload({
        eventKey: reservedKey,
        requestBody: reservedBytes,
        apiKey,
        fetchImpl,
      }),
  });
}
