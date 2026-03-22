import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ListingCard } from "@/components/listing-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

type ListingRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  grade_level: string | null;
  condition: string | null;
  type: string | null;
  listing_type?: string | null;
  price: number | null;
  original_price: number | null;
  estimated_retail_price?: number | null;
  seller_id: string | null;
  user_id?: string | null;
  school_id: string | null;
  status: string | null;
  created_at: string | null;
};

type ListingPhotoRow = {
  id: string;
  listing_id: string;
  url: string;
  sort_order: number | null;
};

function buildPhotosMap(rows: ListingPhotoRow[]) {
  const grouped = new Map<string, string[]>();

  for (const row of rows) {
    if (!grouped.has(row.listing_id)) {
      grouped.set(row.listing_id, []);
    }

    grouped.get(row.listing_id)?.push(row.url);
  }

  return grouped;
}

export default async function FavoritesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const [{ data: favorites }, { data: currentProfile }] = await Promise.all([
    supabase.from("favorites").select("listing_id").eq("user_id", user.id),
    supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle(),
  ]);

  const favoriteIds = (favorites || []).map(
    (fav: { listing_id: string }) => fav.listing_id
  );

  let listings: ListingRow[] = [];
  let photosMap = new Map<string, string[]>();

  if (favoriteIds.length > 0) {
    const { data: listingsData } = await supabase
      .from("listings")
      .select(
        "id, title, description, category, grade_level, condition, type, listing_type, price, original_price, estimated_retail_price, seller_id, user_id, school_id, status, created_at"
      )
      .in("id", favoriteIds)
      .eq("status", "available")
      .order("created_at", { ascending: false });

    listings = (listingsData || []) as ListingRow[];

    if (listings.length > 0) {
      const listingIds = listings.map((item) => item.id);

      const { data: listingPhotos } = await supabase
        .from("listing_photos")
        .select("id, listing_id, url, sort_order")
        .in("listing_id", listingIds)
        .order("sort_order", { ascending: true });

      photosMap = buildPhotosMap((listingPhotos || []) as ListingPhotoRow[]);
    }
  }

  const mappedListings = listings.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    gradeLevel: item.grade_level,
    condition: item.condition,
    type: item.type || item.listing_type,
    price: item.price ?? undefined,
    originalPrice:
      item.original_price ?? item.estimated_retail_price ?? undefined,
    photos: photosMap.get(item.id) || [],
    sellerId: item.seller_id || item.user_id || null,
    schoolId: item.school_id || null,
    status: item.status,
    createdAt: item.created_at,
    distance: undefined,
    isFavorite: true,
  }));

  const currentSchoolId =
    currentProfile?.school_id && currentProfile.school_id.trim().length > 0
      ? currentProfile.school_id
      : "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Favoritos</h1>
        <p className="mt-2 text-muted-foreground">
          Guarda aquí los anuncios que quieres revisar más tarde.
        </p>
      </div>

      {mappedListings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Heart className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">Aún no tienes favoritos</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pulsa el corazón en cualquier anuncio para guardarlo aquí.
            </p>

            <Link href="/marketplace" className="mt-6">
              <Button>Explorar marketplace</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {mappedListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              currentSchoolId={currentSchoolId}
            />
          ))}
        </div>
      )}
    </div>
  );
}