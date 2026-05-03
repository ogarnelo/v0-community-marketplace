import { createClient } from "@/lib/supabase/server";
import { buildPhotosMap, type ListingPhotoRow, type MarketplaceListing } from "@/lib/types/marketplace";

type Params = {
  q?: string | null;
  category?: string | null;
  grade?: string | null;
  condition?: string | null;
  type?: string | null;
  isbn?: string | null;
  sort?: string | null;
  limit?: number;
  currentUserId?: string | null;
};

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalize(value?: string | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text !== "all" ? text : null;
}

function scoreListing(listing: any, boostMap: Map<string, string>) {
  const boostedAt = boostMap.get(listing.id);
  const createdAt = listing.created_at ? new Date(listing.created_at).getTime() : 0;
  const boostedScore = boostedAt ? new Date(boostedAt).getTime() + 10_000_000_000 : 0;

  return Math.max(createdAt, boostedScore);
}

export async function getRankedListings(params: Params = {}) {
  const supabase = await createClient();
  const limit = Math.min(params.limit || 48, 80);

  let query = supabase
    .from("listings")
    .select(
      "id, title, category, grade_level, condition, type, listing_type, isbn, price, original_price, estimated_retail_price, seller_id, user_id, school_id, status, created_at"
    )
    .eq("status", "available")
    .limit(limit);

  const q = normalize(params.q);
  const category = normalize(params.category);
  const grade = normalize(params.grade);
  const condition = normalize(params.condition);
  const listingType = normalize(params.type);
  const isbn = normalize(params.isbn);

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,isbn.ilike.%${q}%`);
  }
  if (category) query = query.eq("category", category);
  if (grade) query = query.eq("grade_level", grade);
  if (condition) query = query.eq("condition", condition);
  if (listingType) query = query.or(`type.eq.${listingType},listing_type.eq.${listingType}`);
  if (isbn) query = query.ilike("isbn", `%${isbn}%`);

  const { data: listingsData, error } = await query.order("created_at", { ascending: false });

  if (error || !listingsData) {
    console.error("getRankedListings fallback error:", error);
    return [] as MarketplaceListing[];
  }

  const listingRows = listingsData as any[];
  const listingIds = listingRows.map((item) => item.id);

  let photosMap = new Map<string, string[]>();
  let boostMap = new Map<string, string>();
  let favoritesSet = new Set<string>();

  if (listingIds.length > 0) {
    const photosResult = await supabase
      .from("listing_photos")
      .select("id, listing_id, url, sort_order")
      .in("listing_id", listingIds)
      .order("sort_order", { ascending: true });

    if (!photosResult.error) {
      photosMap = buildPhotosMap((photosResult.data || []) as ListingPhotoRow[]);
    }

    try {
      const { data: boostsData } = await supabase
        .from("listing_boosts")
        .select("listing_id, created_at, featured_until")
        .in("listing_id", listingIds)
        .order("created_at", { ascending: false });

      for (const boost of boostsData || []) {
        const featuredUntil = boost.featured_until ? new Date(boost.featured_until).getTime() : Date.now() + 1;
        if (featuredUntil >= Date.now() && !boostMap.has(boost.listing_id)) {
          boostMap.set(boost.listing_id, boost.created_at);
        }
      }
    } catch {
      boostMap = new Map();
    }

    if (params.currentUserId) {
      try {
        const { data: favorites } = await supabase
          .from("favorites")
          .select("listing_id")
          .eq("user_id", params.currentUserId)
          .in("listing_id", listingIds);

        favoritesSet = new Set((favorites || []).map((row: any) => row.listing_id));
      } catch {
        favoritesSet = new Set();
      }
    }
  }

  const listings: MarketplaceListing[] = listingRows.map((item) => ({
    id: item.id,
    title: item.title || "Anuncio sin título",
    description: null,
    category: item.category,
    gradeLevel: item.grade_level,
    condition: item.condition,
    type: item.type || item.listing_type,
    isbn: item.isbn || null,
    price: item.price ?? undefined,
    originalPrice: item.original_price ?? item.estimated_retail_price ?? undefined,
    photos: photosMap.get(item.id) || [],
    sellerId: item.seller_id || item.user_id || null,
    schoolId: item.school_id || null,
    status: item.status,
    createdAt: item.created_at || null,
    isFavorite: favoritesSet.has(item.id),
  }));

  const sort = params.sort || "relevance";

  listings.sort((a, b) => {
    if (sort === "price-asc") return toNumber(a.price) - toNumber(b.price);
    if (sort === "price-desc") return toNumber(b.price) - toNumber(a.price);
    if (sort === "savings") {
      const savingA = toNumber(a.originalPrice) - toNumber(a.price);
      const savingB = toNumber(b.originalPrice) - toNumber(b.price);
      return savingB - savingA;
    }
    if (sort === "title") return a.title.localeCompare(b.title, "es");
    return scoreListing(b, boostMap) - scoreListing(a, boostMap);
  });

  return listings;
}
