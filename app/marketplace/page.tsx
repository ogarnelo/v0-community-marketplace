import { MarketplaceClient } from "@/components/marketplace/marketplace-client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import {
  buildPhotosMap,
  type ListingPhotoRow,
  type ListingRow,
  type MarketplaceListing,
  type ProfileRow,
} from "@/lib/types/marketplace";

export const dynamic = "force-dynamic";

export const metadata = buildPublicMetadata({
  title: "Material escolar de segunda mano",
  description: "Encuentra libros de texto usados, uniformes, mochilas y material escolar de segunda mano o donado por otras familias.",
  path: "/marketplace",
});

export default async function MarketplacePage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let favoriteIds = new Set<string>();
  let viewerSchoolId = "";
  let viewerPostalCode = "";

  if (user) {
    const [{ data: favorites }, { data: profile }] = await Promise.all([
      supabase.from("favorites").select("listing_id").eq("user_id", user.id),
      supabase
        .from("profiles")
        .select("id, full_name, user_type, school_id, postal_code")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    favoriteIds = new Set(
      (favorites || []).map((fav: { listing_id: string }) => fav.listing_id)
    );

    const typedProfile = (profile as ProfileRow | null) ?? null;
    viewerSchoolId = typedProfile?.school_id?.trim() || "";
    viewerPostalCode = typedProfile?.postal_code?.trim() || "";
  }

  const { data: listingsData, error: listingsError } = await supabase
    .from("listings")
    .select(
      "id, title, description, category, grade_level, condition, type, listing_type, isbn, author, publisher, format, language, subject, specific_type, size_label, brand, model, season, price, original_price, estimated_retail_price, seller_id, user_id, school_id, postal_code, status, created_at"
    )
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(60);

  if (listingsError) {
    console.error("Error cargando listings server-first:", listingsError);
  }

  const listingRows = ((listingsData || []) as ListingRow[]) ?? [];
  const listingIds = listingRows.map((item) => item.id);
  const sellerIds = Array.from(
    new Set(
      listingRows
        .map((item) => item.seller_id || item.user_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );
  const sellerProfileMap = new Map<
    string,
    { schoolId: string | null; postalCode: string | null }
  >();
  const schoolPostalMap = new Map<string, string | null>();
  let photosMap = new Map<string, string[]>();

  if (sellerIds.length > 0) {
    const { data: sellerProfiles, error: sellerProfilesError } = await admin
      .from("profiles")
      .select("id, school_id, postal_code")
      .in("id", sellerIds);

    if (sellerProfilesError) {
      console.error("Error cargando la ubicación actual de los vendedores:", sellerProfilesError);
    } else {
      for (const profile of sellerProfiles || []) {
        sellerProfileMap.set(profile.id, {
          schoolId: profile.school_id || null,
          postalCode: profile.postal_code || null,
        });
      }
    }
  }

  const relevantSchoolIds = Array.from(
    new Set(
      [
        viewerSchoolId,
        ...Array.from(sellerProfileMap.values()).map((profile) => profile.schoolId || ""),
        ...listingRows.map((item) => item.school_id || ""),
      ].filter(Boolean)
    )
  );

  if (relevantSchoolIds.length > 0) {
    const { data: schools, error: schoolsError } = await admin
      .from("schools")
      .select("id, postal_code")
      .in("id", relevantSchoolIds);

    if (schoolsError) {
      console.error("Error cargando la ubicación de los centros:", schoolsError);
    } else {
      for (const school of schools || []) {
        schoolPostalMap.set(school.id, school.postal_code || null);
      }
    }
  }

  if (viewerSchoolId) {
    viewerPostalCode = schoolPostalMap.get(viewerSchoolId) || viewerPostalCode;
  }

  if (listingIds.length > 0) {
    const { data: listingPhotos, error: listingPhotosError } = await supabase
      .from("listing_photos")
      .select("id, listing_id, url, sort_order")
      .in("listing_id", listingIds)
      .order("sort_order", { ascending: true });

    if (listingPhotosError) {
      console.error("Error cargando listing_photos server-first:", listingPhotosError);
    } else {
      photosMap = buildPhotosMap((listingPhotos || []) as ListingPhotoRow[]);
    }
  }

  const initialListings: MarketplaceListing[] = listingRows.map((item) => {
    const sellerId = item.seller_id || item.user_id || null;
    const sellerProfile = sellerId ? sellerProfileMap.get(sellerId) || null : null;
    const currentSellerSchoolId = sellerProfile?.schoolId || item.school_id || null;
    const currentSellerPostalCode =
      (currentSellerSchoolId ? schoolPostalMap.get(currentSellerSchoolId) || null : null) ||
      sellerProfile?.postalCode ||
      item.postal_code ||
      null;

    return {
    id: item.id,
    title: item.title || "Anuncio sin título",
    description: item.description || null,
    category: item.category,
    gradeLevel: item.grade_level,
    condition: item.condition,
    type: item.type || item.listing_type,
    isbn: item.isbn || null,
    author: item.author || null,
    publisher: item.publisher || null,
    format: item.format || null,
    language: item.language || null,
    subject: item.subject || null,
    specificType: item.specific_type || null,
    sizeLabel: item.size_label || null,
    brand: item.brand || null,
    model: item.model || null,
    season: item.season || null,
    price: item.price ?? undefined,
    originalPrice: item.original_price ?? item.estimated_retail_price ?? undefined,
    photos: photosMap.get(item.id) || [],
    sellerId,
    schoolId: currentSellerSchoolId,
    postalCode: currentSellerPostalCode,
    status: item.status,
    createdAt: item.created_at || null,
    distance: undefined,
    isFavorite: favoriteIds.has(item.id),
    };
  });

  return (
    <MarketplaceClient
      initialListings={initialListings}
      initialSchoolId={viewerSchoolId}
      initialPostalCode={viewerPostalCode}
    />
  );
}
