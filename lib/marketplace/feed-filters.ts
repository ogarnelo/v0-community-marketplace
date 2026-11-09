/**
 * Shared, bounded server-side marketplace search predicates for both feeds.
 *
 * .or() accepts raw PostgREST grammar. Never put an unvalidated user string
 * into that grammar. No new database function or table is required.
 */
export type MarketplaceFeedFilters = {
  text: string;
  isbn: string;
  category: string;
  gradeLevel: string;
  listingType: "sale" | "donation" | "";
  condition: string;
  since: string;
  priceMin: number | null;
  priceMax: number | null;
  sort: "newest" | "price_asc" | "price_desc" | "discount";
};

const SEARCH_COLUMNS = [
  "title", "description", "category", "grade_level", "isbn",
  "author", "publisher", "format", "language", "subject",
  "specific_type", "size_label", "brand", "model", "season",
] as const;
const MAX_PRICE = 200;
const stringField = (params: URLSearchParams, name: string, maxLength = 80) => {
  const value = params.get(name) || "";
  if (value.length > maxLength) throw new Error("invalid_marketplace_filter");
  return value.trim();
};

export function parseMarketplaceFeedFilters(params: URLSearchParams): MarketplaceFeedFilters {
  // Remove PostgREST grammar characters and ILIKE wildcards before building
  // expression strings, preserving Spanish letters and ISBN digits.
  const text = stringField(params, "q", 90)
    .replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  const rawIsbn = stringField(params, "isbn", 30);
  const isbn = rawIsbn.replace(/[^0-9xX]/g, "").toLowerCase();
  const category = stringField(params, "category");
  const gradeLevel = stringField(params, "gradeLevel");
  const condition = stringField(params, "condition", 50);
  const rawType = stringField(params, "listingType", 20);
  if (rawType && rawType !== "sale" && rawType !== "donation") {
    throw new Error("invalid_marketplace_filter");
  }
  const rawMin = params.get("minPrice");
  const rawMax = params.get("maxPrice");
  const parsePrice = (value: string | null) => {
    if (value === null) return null;
    if (!/^(0|[1-9][0-9]{0,2})(?:\.[0-9]{1,2})?$/.test(value))
      throw new Error("invalid_marketplace_filter");
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > MAX_PRICE)
      throw new Error("invalid_marketplace_filter");
    return number;
  };
  const priceMin = parsePrice(rawMin);
  const priceMax = parsePrice(rawMax);
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    throw new Error("invalid_marketplace_filter");
  }
  const since = stringField(params, "since", 30);
  if (since) {
    const value = new Date(since);
    const age = Date.now() - value.getTime();
    if (!Number.isFinite(age) || !since.endsWith("Z") ||
        age < -24 * 3600 * 1000 || age > 35 * 24 * 3600 * 1000) {
      throw new Error("invalid_marketplace_filter");
    }
  }
  const rawSort = stringField(params, "sort", 20);
  const sort: MarketplaceFeedFilters["sort"] =
    rawSort === "price_asc" || rawSort === "price_desc" || rawSort === "discount" ? rawSort : "newest";
  return { text, isbn, category, gradeLevel, listingType: rawType as
    MarketplaceFeedFilters["listingType"], condition, since,
    priceMin, priceMax, sort };
}

export function hasServerMarketplaceFilters(filters: MarketplaceFeedFilters): boolean {
  return Boolean(filters.text || filters.isbn || filters.category ||
    filters.gradeLevel || filters.listingType || filters.condition ||
    filters.since || filters.priceMin !== null || filters.priceMax !== null ||
    filters.sort !== "newest");
}

export function buildMarketplacePostgrestExpression(
  filters: MarketplaceFeedFilters, schoolScopeExpression?: string | null
): string | null {
  const terms: string[] = [];
  if (schoolScopeExpression) {
    // School scope is generated only from UUIDs + validated official codes in
    // school-scope.ts, never from caller-controlled query parameters.
    terms.push("or(" + schoolScopeExpression + ")");
  }
  if (filters.text) {
    terms.push("or(" + SEARCH_COLUMNS.map((column) =>
      `${column}.ilike.*${filters.text}*`).join(",") + ")");
  }
  if (filters.priceMin !== null || filters.priceMax !== null) {
    // Donations have no price limit in the existing UX; preserve them.
    const low = filters.priceMin ?? 0;
    const high = filters.priceMax ?? MAX_PRICE;
    const paid = filters.priceMax !== null
      ? `and(price.gte.${low},price.lte.${high})`
      : `price.gte.${low}`;
    terms.push(`or(type.eq.donation,${paid})`);
  }
  if (terms.length === 0) return null;
  if (terms.length === 1) {
    // The outer .or() already wraps the grammar in "or=(...)"
    return terms[0].slice(3, -1);
  }
  return `and(${terms.join(",")})`;
}

// The Supabase query builder type has project-specific schema generics. Keep
// the original builder's methods and value types as supplied by supabase-js.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyMarketplaceFeedFilters(query: any,
  filters: MarketplaceFeedFilters, schoolScopeExpression?: string | null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.gradeLevel) query = query.eq("grade_level", filters.gradeLevel);
  if (filters.condition) query = query.eq("condition", filters.condition);
  if (filters.listingType) query = query.eq("type", filters.listingType);
  if (filters.isbn) query = query.ilike("isbn", `%${filters.isbn}%`);
  if (filters.since) query = query.gte("created_at", filters.since);

  const expression = buildMarketplacePostgrestExpression(
    filters, schoolScopeExpression);
  if (expression) query = query.or(expression);
  if (filters.sort === "price_asc") {
    return query.order("price", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  }
  if (filters.sort === "price_desc") {
    return query.order("price", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  }
  if (filters.sort === "discount") {
    return query.order("savings_amount", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  }
  return query.order("created_at", { ascending: false })
    .order("id", { ascending: false });
}
