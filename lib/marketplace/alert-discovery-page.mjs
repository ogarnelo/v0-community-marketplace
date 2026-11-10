/**
 * A bounded UUID-keyset discovery page. A full page requires a continuation;
 * a short/empty page definitively reaches the end of the search snapshot.
 * Never advance a durable cursor until the page's matches have been stored.
 */
export const WORKER_DISCOVERY_PAGE_SIZE = 200;

export function summarizeDiscoveryPage(rows, expectedCursor) {
  if (!Array.isArray(rows) || rows.length > WORKER_DISCOVERY_PAGE_SIZE) {
    throw new Error("Invalid discovery page length");
  }
  let cursor = expectedCursor;
  for (const item of rows) {
    if (typeof item?.id !== "string" || !item.id ||
      (cursor !== null && item.id <= cursor)) {
      throw new Error("Discovery page must advance in UUID order");
    }
    cursor = item.id;
  }
  return {
    nextCursor: rows.length ? cursor : expectedCursor,
    complete: rows.length < WORKER_DISCOVERY_PAGE_SIZE,
    scanned: rows.length,
  };
}
