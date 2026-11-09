import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyMarketplaceFeedFilters,
  parseMarketplaceFeedFilters,
} from "@/lib/marketplace/feed-filters";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  makeMarketplaceSchoolFilter,
  resolveMarketplaceSchoolScope,
} from "@/lib/marketplace/school-scope";
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
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Inicia sesión para ver tu colegio." }, { status: 401 });
  }

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
  if (offset > 999999) {
    return NextResponse.json({ error: "Página fuera de rango." }, { status: 400 });
  }

  const [{ data: profile, error: profileError },
         { data: student, error: studentError },
         { data: schoolAdmin, error: roleError }] = await Promise.all([
    supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle(),
    supabase.from("account_students")
      .select("school_id,directory_school_code,is_primary,sort_order,created_at")
      .eq("owner_user_id", user.id).eq("active", true)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("user_roles").select("school_id").eq("user_id", user.id)
      .eq("role", "school_admin").not("school_id", "is", null)
      .limit(1).maybeSingle(),
  ]);
  if (profileError || studentError || roleError) {
    return NextResponse.json({ error: "No se pudo determinar tu colegio." }, { status: 503 });
  }
  const directoryCode = schoolAdmin?.school_id
    ? "" : student?.directory_school_code?.trim() || "";
  const schoolId = schoolAdmin?.school_id ||
    (student ? student.school_id || "" : profile?.school_id || "");
  try {
    const schoolScope = await resolveMarketplaceSchoolScope(schoolId, directoryCode);
    const expression = makeMarketplaceSchoolFilter(schoolScope);
    if (!expression) {
      return NextResponse.json({ listings: [], total: 0, offset, hasMore: false }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    // The school scope and other OR predicates are composed into one
    // validated PostgREST expression before filtering and ordering.
    const query = applyMarketplaceFeedFilters(
      supabase.from("listings").select(FIELDS, { count: "exact" })
        .eq("status", "available"),
      filters, expression
    );
    const { data, count, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data || []) as ListingRow[];
    const ids = rows.map((row) => row.id);
    const sellers = Array.from(new Set(rows.map((row) => row.seller_id || row.user_id)
      .filter((id): id is string => typeof id === "string" && Boolean(id))));
    const admin = createAdminClient();
    const [{ data: photos, error: photoError },
           { data: profiles, error: sellerError },
           { data: favorites, error: favoriteError }] = await Promise.all([
      ids.length
        ? supabase.from("listing_photos").select("id,listing_id,url,sort_order")
          .in("listing_id", ids).order("sort_order", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      sellers.length
        ? admin.from("profiles").select("id,school_id,postal_code").in("id", sellers)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? supabase.from("favorites").select("listing_id").eq("user_id", user.id)
          .in("listing_id", ids)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (photoError || sellerError || favoriteError) {
      throw new Error("No se pudo preparar el catálogo del colegio");
    }

    const photosMap = buildPhotosMap((photos || []) as ListingPhotoRow[]);
    const sellerMap = new Map((profiles || []).map((p) =>
      [p.id, { schoolId: p.school_id || null, postalCode: p.postal_code || null }] as const));
    const favoriteIds = new Set((favorites || []).map((f) => f.listing_id));
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
        brand: item.brand || null, model: item.model || null, season: item.season || null,
        price: item.price ?? undefined,
        originalPrice: item.original_price ?? item.estimated_retail_price ?? undefined,
        photos: photosMap.get(item.id) || [], sellerId,
        // An explicit national-directory reference overrides a stale seller
        // profile affiliation, just as it does in the original marketplace.
        schoolId: item.directory_school_code ? null :
          item.school_id || seller?.schoolId || null,
        directorySchoolCode: item.directory_school_code || null,
        postalCode: seller?.postalCode || item.postal_code || null,
        status: item.status, createdAt: item.created_at || null,
        isFavorite: favoriteIds.has(item.id),
      };
    });

    const total = count || 0;
    return NextResponse.json({
      listings, total, offset,
      hasMore: offset + listings.length < total,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Error obteniendo anuncios del colegio:", error);
    return NextResponse.json({ error: "No se pudo cargar el catálogo del colegio." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
