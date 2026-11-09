import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const rawOffset = new URL(request.url).searchParams.get("offset") || "0";
  if (!/^(0|[1-9][0-9]{0,5})$/.test(rawOffset)) {
    return NextResponse.json({ error: "Página incorrecta." }, { status: 400 });
  }
  const offset = Number(rawOffset);
  if (offset > 999999) {
    return NextResponse.json({ error: "Página fuera de rango." }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    // Ask for one extra row instead of exact-count scanning on every page.
    const { data, error } = await supabase.from("listings")
      .select(FIELDS).eq("status", "available")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE);
    if (error) throw error;
    const allRows = (data || []) as ListingRow[];
    const hasMore = allRows.length > PAGE_SIZE;
    const rows = allRows.slice(0, PAGE_SIZE);
    const ids = rows.map((row) => row.id);
    const sellers = Array.from(new Set(rows.map((row) => row.seller_id || row.user_id)
      .filter((id): id is string => typeof id === "string" && Boolean(id))));
    const admin = createAdminClient();
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
