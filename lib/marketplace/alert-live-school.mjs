/**
 * Verify a bounded outbox delivery page against CURRENT directory links.
 * This deliberately uses the same savedSearchMatchesListing() school rule
 * as discovery. Only flags are stored, never school names or user data.
 */
export function savedSearchForMatch(match) {
  return Array.isArray(match?.saved_searches)
    ? match.saved_searches[0] : match?.saved_searches;
}

/** @param {Array<{saved_searches?:object}>} page */
export function codesForLiveSchoolPage(page, listing) {
  if (!Array.isArray(page)) throw new TypeError("Invalid school delivery page");
  const codes = new Set();
  for (const match of page) {
    const search = savedSearchForMatch(match);
    if (!search?.only_my_community) continue;
    if (typeof search.directory_school_code === "string" && search.directory_school_code.trim()) {
      codes.add(search.directory_school_code.trim());
    }
    if (typeof listing?.directory_school_code === "string" && listing.directory_school_code.trim()) {
      codes.add(listing.directory_school_code.trim());
    }
  }
  return [...codes];
}

/**
 * The callback is the existing savedSearchMatchesListing(search, listing,
 * distanceKm, links) matcher, reused with school-only fields.
 */
export function partitionLiveSchool(page, listing, directoryLinks, matchesSchoolOnly) {
  if (!Array.isArray(page) || !(directoryLinks instanceof Map) ||
    typeof matchesSchoolOnly !== "function" || !listing) {
    throw new TypeError("Invalid live school verification input");
  }
  const deliverable = [];
  const invalidated = [];
  for (const match of page) {
    const search = savedSearchForMatch(match);
    if (!search || search.notifications_enabled !== true) {
      invalidated.push(match);
      continue;
    }
    if (!search.only_my_community) {
      deliverable.push(match);
      continue;
    }
    // Keep the exact discovery semantics. Directory codes win over stale
    // operational school IDs; absent mappings fail closed.
    const links = {
      savedDirectoryLinkedSchoolId:
        directoryLinks.get(search.directory_school_code?.trim() || "") || null,
      listingDirectoryLinkedSchoolId:
        directoryLinks.get(listing.directory_school_code?.trim() || "") || null,
    };
    const schoolOnly = {
      only_my_community: true,
      school_id: search.school_id || null,
      directory_school_code: search.directory_school_code || null,
      radius_km: null,
    };
    if (!matchesSchoolOnly(schoolOnly, listing, undefined, links)) {
      invalidated.push(match);
    } else {
      deliverable.push(match);
    }
  }
  return { deliverable, invalidated };
}
