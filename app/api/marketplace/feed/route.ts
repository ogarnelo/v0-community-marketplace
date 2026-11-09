import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyMarketplaceFeedFilters,
  parseMarketplaceFeedFilters,
} from "@/lib/marketplace/feed-filters";

import { createAdminClient } from "@/lib/supabase/admin";
import { approximateDistanceKm, hasKnownPostalCode } from "@/lib/marketplace/postal-distance";
import {
  buildPhotosMap,
  type ListingPhotoRow,
  type ListingRow,
  type MarketplaceListing,
} from "@/lib/types/marketplace";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 60;
const FIELDS =
  "id, title, description, category, grade_level, condition, type, listing_type, isbn, author, publisher, format, language, subject, specific_type, size_label, brand, model, season, price, original_price, estimated_retail_price, seller_id, user_id, school_id, directory_school_code, postal_code, status, created_at";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  let filters;
  try {
    filters = parseMarketplaceFeedFilters(params);
  } catch {
    return NextResponse.json({ error: "Filtros incorrectos." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
  const rawOffset = params.get("offset") || "0";
  if (!/^(0|[1-9][0-9]{0,5})$/.test(rawOffset)) {
    return NextResponse.json({ error: "Página incorrecta." }, { status: 400 });
  }
  const offset = Number(rawOffset);
  const rawRadius = params.get("radiusKm");
  if (rawRadius !== null && (!/^[1-9][0-9]{0,2}$/.test(rawRadius) || Number(rawRadius) > 200)) {
    return NextResponse.json({ error: "Radio incorrecto." }, { status: 400 });
  }
  const radiusKm = rawRadius === null ? null : Number(rawRadius);
  if (offset > 999999) {
    return NextResponse.json({ error: "Página fuera de rango." }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const admin = createAdminClient();
    // Read the viewer's postcode from the authenticated account, never a
    // caller-supplied URL parameter (which could expose arbitrary distances).
    if (radiusKm !== null && !user) {
      return NextResponse.json({ error: "Inicia sesión para buscar por distancia." },
        { status: 401, headers: { "Cache-Control": "private, no-store" } });
    }
    const { data: viewerProfile, error: viewerError } = user
      ? await supabase.from("profiles").select("postal_code").eq("id", user.id).maybeSingle()
      : { data: null, error: null };
    if (viewerError) throw viewerError;
    const viewerPostalCode = viewerProfile?.postal_code?.trim() || "";
    if (radiusKm !== null && !hasKnownPostalCode(viewerPostalCode)) {
      return NextResponse.json({ error: "Añade un código postal válido en Mi cuenta." },
        { status: 422, headers: { "Cache-Control": "private, no-store" } });
    }

    let rows: ListingRow[];
    let hasMore: boolean;
    const nearbyDistances = new Map<string, number>();
    if (radiusKm !== null) {
      // The spatial predicate and all product filters run in the database
      // BEFORE OFFSET/LIMIT. No sequential scan of irrelevant pages in JS.
      const { data: nearby, error: nearbyError } = await admin.rpc(
        "marketplace_nearby_listing_page_v1", {
          p_postal_code: viewerPostalCode, p_radius_km: radiusKm,
          p_query: filters.text, p_isbn: filters.isbn,
          p_category: filters.category, p_grade_level: filters.gradeLevel,
          p_listing_type: filters.listingType, p_condition: filters.condition,
          p_since: filters.since || null, p_price_min: filters.priceMin,
          p_price_max: filters.priceMax,
          p_sort: params.get("sort") === "distance" || params.get("sort") === "discount"
            ? params.get("sort") : filters.sort,
          p_offset: offset, p_page_size: PAGE_SIZE + 1,
        }
      );
      if (nearbyError) throw nearbyError;
      const matches = (nearby || []) as { listing_id: string; distance_km: number }[];
      hasMore = matches.length > PAGE_SIZE;
      const page = matches.slice(0, PAGE_SIZE);
      for (const match of page) nearbyDistances.set(match.listing_id, match.distance_km);
      const requestedIds = page.map((match) => match.listing_id);
      if (requestedIds.length) {
        const { data, error } = await supabase.from("listings").select(FIELDS)
          .eq("status", "available").in("id", requestedIds);
        if (error) throw error;
        const byId = new Map(((data || []) as ListingRow[]).map((item) => [item.id, item]));
        rows = requestedIds.map((id) => byId.get(id)).filter((item): item is ListingRow => !!item);
      } else rows = [];
    } else {
      // Preserve the existing general feed and its efficient one-extra-row
      // pagination. No geospatial work is done for users without a radius.
      const query = applyMarketplaceFeedFilters(
        supabase.from("listings").select(FIELDS).eq("status", "available"), filters
      );
      const { data, error } = await query.range(offset, offset + PAGE_SIZE);
      if (error) throw error;
      const allRows = (data || []) as ListingRow[];
      hasMore = allRows.length > PAGE_SIZE;
      rows = allRows.slice(0, PAGE_SIZE);
    }
    const ids = rows.map((row) => row.id);
    const sellers = Array.from(new Set(rows.map((row) => row.seller_id || row.user_id)
      .filter((id): id is string => typeof id === "string" && Boolean(id))));
    const [{ data: photos, error: photoError },
           { data: sellerProfiles, error: sellerError },
           { data: favorites, error: favoriteError }] = await Promise.all([
      ids.length
        ? supabase.from("listing_photos")
          .select("id,listing_id,url,sort_order").in("listing_id", ids)
          .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      sellers.length
        ? admin.from("profiles")
          .select("id,school_id,postal_code").in("id", sellers)
        : Promise.resolve({ data: [], error: null }),
      user && ids.length
        ? supabase.from("favorites").select("listing_id")
          .eq("user_id", user.id).in("listing_id", ids)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (photoError || sellerError || favoriteError) {
      throw new Error("listing_enrichment_failed");
    }
    const photoMap = buildPhotosMap((photos || []) as ListingPhotoRow[]);
    const sellerMap = new Map((sellerProfiles || []).map((row) =>
      [row.id, { schoolId: row.school_id || null,
                 postalCode: row.postal_code || null }] as const));
    const favoriteIds = new Set((favorites || []).map((row) => row.listing_id));
    const listings: MarketplaceListing[] = rows.map((item) => {
      const sellerId = item.seller_id || item.user_id || null;
      const seller = sellerId ? sellerMap.get(sellerId) || null : null;
      return {
        id: item.id, title: item.title || "Anuncio sin título",
        description: item.description || null,
        category: item.category, gradeLevel: item.grade_level,
        condition: item.condition, type: item.type || item.listing_type,
        isbn: item.isbn || null, author: item.author || null,
        publisher: item.publisher || null, format: item.format || null,
        language: item.language || null, subject: item.subject || null,
        specificType: item.specific_type || null, sizeLabel: item.size_label || null,
        brand: item.brand || null, model: item.model || null,
        season: item.season || null, price: item.price ?? undefined,
        originalPrice: item.original_price ?? item.estimated_retail_price ?? undefined,
        photos: photoMap.get(item.id) || [], sellerId,
        // Never mistake a directory-only listing for a profile's old community.
        schoolId: item.directory_school_code ? null :
          item.school_id || seller?.schoolId || null,
        directorySchoolCode: item.directory_school_code || null,
        postalCode: seller?.postalCode || item.postal_code || null,
        status: item.status, createdAt: item.created_at || null,
        distance: nearbyDistances.get(item.id) ?? approximateDistanceKm(
          viewerPostalCode, seller?.postalCode || item.postal_code),
        isFavorite: favoriteIds.has(item.id),
      };
    });
    return NextResponse.json({ listings, hasMore, offset }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Error leyendo la siguiente página del marketplace:", error);
    return NextResponse.json({ error: "No se pudo cargar más anuncios." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
