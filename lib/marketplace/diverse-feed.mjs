/**
 * Stable, zero-request category mix for an unfiltered marketplace feed.
 *
 * Only rearranges each already-fetched page of up to 60 listings. It never
 * hides products, combines pages, fetches extra data or changes filters.
 * Listing order *within* each category stays newest-first as received.
 *
 * @template {{ id: string, category?: string | null }} T
 * @param {readonly T[]} listings
 * @param {number} pageSize
 * @returns {T[]}
 */
export function diversifyRecentPages(listings, pageSize = 60) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new RangeError("Invalid page size");
  /** @type {T[]} */
  const mixed = [];
  for (let start = 0; start < listings.length; start += pageSize) {
    const page = listings.slice(start, start + pageSize);
    /** @type {Map<string, T[]>} */
    const groups = new Map();
    for (const listing of page) {
      const category = listing.category?.trim().toLocaleLowerCase("es") || "sin categoría";
      const queue = groups.get(category);
      if (queue) queue.push(listing);
      else groups.set(category, [listing]);
    }
    let previousCategory = "";
    while (mixed.length < Math.min(start + page.length, listings.length)) {
      const available = [...groups.entries()]
        .filter(([, queue]) => queue.length > 0)
        // Prefer categories with more remaining cards; avoid repeating the
        // previous one whenever another category is still available.
        .sort((a, b) => b[1].length - a[1].length);
      const picked = available.find(([name]) => name !== previousCategory) || available[0];
      if (!picked) break;
      const next = picked[1].shift();
      if (next) mixed.push(next);
      previousCategory = picked[0];
    }
  }
  return mixed;
}
