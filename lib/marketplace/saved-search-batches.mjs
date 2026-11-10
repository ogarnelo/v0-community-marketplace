/**
 * Keyset pagination for alert candidate retrieval.
 *
 * The caller MUST order every page by id ASC and apply id > afterId.
 * This avoids the default API row cap silently dropping searches after
 * the first page. No DB writes and no fixed global search limit.
 *
 * @template {{id: string}} T
 * @param {(afterId: string | null, limit: number) => Promise<T[]>} fetchPage
 * @param {number} [pageSize]
 * @returns {Promise<T[]>}
 */
export async function loadAllSortedPages(fetchPage, pageSize = 200) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new RangeError("Invalid saved-search page size");
  }
  /** @type {T[]} */
  const collected = [];
  let afterId = null;
  for (;;) {
    const page = await fetchPage(afterId, pageSize);
    if (!Array.isArray(page) || page.length > pageSize) {
      throw new Error("Invalid saved-search page");
    }
    for (const search of page) {
      if (typeof search?.id !== "string" || !search.id ||
          (afterId !== null && search.id <= afterId)) {
        throw new Error("Saved-search pages must be strictly ordered by ID");
      }
      collected.push(search);
      afterId = search.id;
    }
    if (page.length < pageSize) return collected;
  }
}

/**
 * Bound every Supabase write and .in(...) lookup to small deterministic groups.
 *
 * @template T
 * @param {readonly T[]} items
 * @param {number} [batchSize]
 * @returns {T[][]}
 */
export function batchAlertItems(items, batchSize = 150) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new RangeError("Invalid alert batch size");
  }
  /** @type {T[][]} */
  const groups = [];
  for (let start = 0; start < items.length; start += batchSize) {
    groups.push(items.slice(start, start + batchSize));
  }
  return groups;
}
