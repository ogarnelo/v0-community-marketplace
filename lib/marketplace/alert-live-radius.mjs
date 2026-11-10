/**
 * A saved search may still be active even after its owner changes postcode.
 * The search's saved radius does not change when profiles.postal_code changes.
 *
 * Before an outbox worker notifies or emails, revalidate ONLY a bounded
 * delivery page against current profile zones; return opaque match IDs for
 * terminal invalidation. This module neither stores nor exposes postcodes.
 */
export function hasRadiusConstraint(match) {
  const search = Array.isArray(match?.saved_searches)
    ? match.saved_searches[0] : match?.saved_searches;
  return search?.radius_km !== null && search?.radius_km !== undefined;
}

/**
 * @param {Array<{id:string,user_id:string,saved_searches?:object}>} matches
 * @param {Map<string,string|null>} userPostcodes
 * @param {string|null} listingPostalCode
 * @param {(from?:string|null,to?:string|null)=>number|undefined} distanceKm
 */
export function partitionLiveRadius(matches, userPostcodes, listingPostalCode, distanceKm) {
  if (!Array.isArray(matches) || !(userPostcodes instanceof Map) ||
    typeof distanceKm !== "function") {
    throw new TypeError("Invalid live radius verification input");
  }
  const deliverable = [];
  const invalidated = [];
  for (const match of matches) {
    const search = Array.isArray(match?.saved_searches)
      ? match.saved_searches[0] : match?.saved_searches;
    // The DB uses an INNER JOIN for enabled, unmodified saved searches.
    // A missing/broken relationship must fail closed, never email everyone.
    if (!search || search.notifications_enabled !== true) {
      invalidated.push(match);
      continue;
    }
    const radius = search.radius_km;
    if (radius !== null && radius !== undefined) {
      const distance = distanceKm(userPostcodes.get(match.user_id) || null, listingPostalCode);
      if (!Number.isFinite(radius) || radius < 0 ||
        !Number.isFinite(distance) || distance > radius) {
        invalidated.push(match);
        continue;
      }
    }
    deliverable.push(match);
  }
  return {deliverable, invalidated};
}
