import { batchAlertItems } from "./saved-search-batches.mjs";
import { WORKER_RECIPIENT_BATCH_SIZE } from "./alert-delivery-progress.mjs";

/**
 * Load pending matches without fetching every recipient into memory.
 *
 * Recovery needs only twelve recipients per invocation plus ONE extra row to
 * know whether a later invocation is required. Scans all ID batches until
 * the sentinel is found or all IDs have been checked: there is no hidden
 * audience cap. Normal seller dispatch keeps its original full coverage.
 *
 * @template {{saved_search_id:string}} T
 * @template {{id:string,user_id:string}} R
 * @param {T[]} matches
 * @param {boolean} isWorker
 * @param {(batch:T[], limit:number|null)=>Promise<R[]>} fetchBatch
 * @returns {Promise<R[]>}
 */
export async function loadPendingDeliveryRows(matches, isWorker, fetchBatch) {
  if (!Array.isArray(matches) || typeof fetchBatch !== "function") {
    throw new TypeError("Invalid pending delivery arguments");
  }
  const ceiling = isWorker ? WORKER_RECIPIENT_BATCH_SIZE + 1 : null;
  /** @type {R[]} */
  const pending = [];

  for (const batch of batchAlertItems(matches)) {
    const remaining = ceiling === null ? null : ceiling - pending.length;
    if (remaining !== null && remaining <= 0) break;

    const rows = await fetchBatch(batch, remaining);
    if (!Array.isArray(rows) || rows.length > batch.length ||
      (remaining !== null && rows.length > remaining)) {
      throw new Error("Invalid bounded pending delivery response");
    }
    pending.push(...rows);
  }
  return pending;
}
