/**
 * Best-effort post-publication notifications. Publication is committed first:
 * matching failures must never block the seller's successful navigation.
 *
 * The server enforces ownership and provider/DB idempotency. Retries here are
 * strictly bounded to transient HTTP failures and network exceptions.
 *
 * @param {() => Promise<{ok:boolean,status:number}>} send
 * @param {(ms:number) => Promise<void>} [pause]
 * @returns {Promise<{ok:boolean,attempts:number,reason?:string}>}
 */
export async function dispatchPublishedListingAlerts(
  send,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
) {
  if (typeof send !== "function") throw new TypeError("A send callback is required");
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await send();
      if (response?.ok === true) return { ok: true, attempts: attempt };
      const status = response?.status;
      if (!Number.isInteger(status)) {
        return { ok: false, attempts: attempt, reason: "invalid_response" };
      }
      // Retrying 4xx can duplicate work without ever fixing authorization or
      // invalid input. A 429 is also not retried immediately.
      if (status < 500 || attempt === 2) {
        return { ok: false, attempts: attempt, reason: "http_" + status };
      }
    } catch {
      if (attempt === 2) {
        return { ok: false, attempts: attempt, reason: "network_error" };
      }
    }
    await pause(400);
  }
  return { ok: false, attempts: 2, reason: "unexpected" };
}
