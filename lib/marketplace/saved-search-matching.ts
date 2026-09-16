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
};

type ListingCandidate = {
  id: string;
  title?: string | null;
  description?: string | null;
  isbn?: string | null;
  category?: string | null;
  grade_level?: string | null;
  listing_type?: string | null;
  type?: string | null;
  condition?: string | null;
  school_id?: string | null;
};

function normalize(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function containsText(haystack: string, needle: string | null | undefined) {
  const cleanNeedle = normalize(needle);
  if (!cleanNeedle) return true;
  return haystack.includes(cleanNeedle);
}

export function savedSearchMatchesListing(search: SavedSearchCandidate, listing: ListingCandidate) {
  const searchableText = normalize([listing.title, listing.description, listing.isbn].filter(Boolean).join(" "));
  const listingType = listing.type || listing.listing_type || null;

  if (search.only_my_community && search.school_id && search.school_id !== listing.school_id) return false;
  if (search.category && normalize(search.category) !== normalize(listing.category)) return false;
  if (search.grade_level && normalize(search.grade_level) !== normalize(listing.grade_level)) return false;
  if (search.listing_type && normalize(search.listing_type) !== normalize(listingType)) return false;
  if (search.condition && normalize(search.condition) !== normalize(listing.condition)) return false;
  if (search.isbn_query && normalize(search.isbn_query) !== normalize(listing.isbn)) return false;
  if (search.query && !containsText(searchableText, search.query)) return false;

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
