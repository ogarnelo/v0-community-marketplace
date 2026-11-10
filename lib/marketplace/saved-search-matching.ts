type SavedSearchCandidate = {
  id: string;
  query?: string | null;
  isbn_query?: string | null;
  category?: string | null;
  grade_level?: string | null;
  listing_type?: string | null;
  condition?: string | null;
  only_my_community?: boolean | null;
  school_id?: string | null;
  directory_school_code?: string | null;
  radius_km?: number | null;
};

type ListingCandidate = {
  id: string;
  title?: string | null;
  description?: string | null;
  isbn?: string | null;
  author?: string | null;
  publisher?: string | null;
  format?: string | null;
  language?: string | null;
  subject?: string | null;
  specific_type?: string | null;
  size_label?: string | null;
  brand?: string | null;
  model?: string | null;
  season?: string | null;
  category?: string | null;
  grade_level?: string | null;
  listing_type?: string | null;
  type?: string | null;
  condition?: string | null;
  school_id?: string | null;
  directory_school_code?: string | null;
};

function normalize(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Keep alerts conservative: require EVERY meaningful search term, but not
// necessarily in the same order. This supports natural-language family needs
// without external AI calls, embeddings, or extra API charges.
const SEARCH_FILLERS = new Set([
  "a", "al", "de", "del", "el", "la", "los", "las", "un", "una", "unos",
  "unas", "en", "mi", "mis", "me", "que", "y", "o", "por", "para",
  "favor", "necesito", "busco", "buscando", "quiero", "queria",
  "estoy", "necesitamos", "se", "lo", "le", "su", "sus",
]);
const ORDINALS: Record<string, string> = {
  primero: "1", primera: "1", primer: "1",
  segundo: "2", segunda: "2",
  tercero: "3", tercera: "3", tercer: "3",
  cuarto: "4", cuarta: "4",
  quinto: "5", quinta: "5",
  sexto: "6", sexta: "6",
};

function meaningfulTokens(value: string | null | undefined) {
  return normalize(value)
    .replace(/([0-9]+)[ºª°]/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && !SEARCH_FILLERS.has(token))
    .map((token) => ORDINALS[token] || (token.length > 4 && token.endsWith("s")
      ? token.slice(0, -1) : token));
}

export function hasMeaningfulSearchTerms(value: string | null | undefined) {
  return meaningfulTokens(value).length > 0;
}

function containsText(haystack: string, needle: string | null | undefined) {
  const cleanNeedle = normalize(needle);
  if (!cleanNeedle) return true;
  const terms = meaningfulTokens(needle);
  if (!terms.length) return false; // Never notify everyone for filler-only text.
  // Whole normalized terms avoid accidental matches inside unrelated words.
  const available = new Set(meaningfulTokens(haystack));
  return terms.every((term) => available.has(term));
}

type SchoolDirectoryLinks = {
  savedDirectoryLinkedSchoolId?: string | null;
  listingDirectoryLinkedSchoolId?: string | null;
};

export function savedSearchMatchesListing(
  search: SavedSearchCandidate,
  listing: ListingCandidate,
  distanceKm?: number,
  links?: SchoolDirectoryLinks
) {
  const searchableText = normalize([
    listing.title,
    listing.description,
    listing.isbn,
    listing.author,
    listing.publisher,
    listing.format,
    listing.language,
    listing.subject,
    listing.specific_type,
    listing.size_label,
    listing.brand,
    listing.model,
    listing.season,
  ].filter(Boolean).join(" "));
  const listingType = listing.type || listing.listing_type || null;

  if (search.only_my_community) {
    const savedCode = search.directory_school_code?.trim() || null;
    const listingCode = listing.directory_school_code?.trim() || null;

    if (savedCode) {
      // The explicit national-directory code is authoritative. The listing's
      // directory reference must win over a stale operational school_id.
      if (listingCode) {
        if (savedCode !== listingCode) return false;
      } else if (!links?.savedDirectoryLinkedSchoolId ||
                 listing.school_id !== links.savedDirectoryLinkedSchoolId) {
        return false;
      }
    } else if (search.school_id) {
      if (listingCode) {
        // A directory-only listing may match an active school's saved alert
        // only if the directory explicitly links back to that same school.
        if (!links?.listingDirectoryLinkedSchoolId ||
            links.listingDirectoryLinkedSchoolId !== search.school_id) return false;
      } else if (search.school_id !== listing.school_id) return false;
    } else {
      // Never turn an unknown school identity into a global alert.
      return false;
    }
  }
  if (search.category && normalize(search.category) !== normalize(listing.category)) return false;
  if (search.grade_level && normalize(search.grade_level) !== normalize(listing.grade_level)) return false;
  if (search.listing_type && normalize(search.listing_type) !== normalize(listingType)) return false;
  if (search.condition && normalize(search.condition) !== normalize(listing.condition)) return false;
  if (search.isbn_query && normalize(search.isbn_query) !== normalize(listing.isbn)) return false;
  if (search.query && !containsText(searchableText, search.query)) return false;
  // When a user saved a radius, unknown location must NOT trigger an alert.
  if (search.radius_km !== null && search.radius_km !== undefined &&
      (!Number.isFinite(distanceKm) || distanceKm! > search.radius_km)) return false;

  return true;
}

export function buildSavedSearchMarketplaceUrl(search: SavedSearchCandidate) {
  const params = new URLSearchParams();
  if (search.query) params.set("q", search.query);
  if (search.isbn_query) params.set("isbn", search.isbn_query);
  if (search.category) params.set("category", search.category);
  if (search.grade_level) params.set("grade", search.grade_level);
  if (search.listing_type) params.set("type", search.listing_type);
  if (search.condition) params.set("condition", search.condition);
  if (search.only_my_community) params.set("community", "1");
  const suffix = params.toString();
  return suffix ? `/marketplace?${suffix}` : "/marketplace";
}
