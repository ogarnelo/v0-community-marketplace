import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ListingCard } from "@/components/listing-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

export default async function FavoritesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: favorites } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", user.id);

  const favoriteIds = (favorites || []).map((fav: any) => fav.listing_id);

  let listings: any[] = [];

  if (favoriteIds.length > 0) {
    const { data } = await supabase
      .from("listings")
      .select("*")
      .in("id", favoriteIds)
      .eq("status", "available")
      .order("created_at", { ascending: false });

    listings = data || [];
  }

  const mappedListings = listings.map((item: any) => ({
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
    photos: Array.isArray(item.photos) ? item.photos : [],
    sellerId: item.seller_id || item.user_id || null,
    schoolId: item.school_id || null,
    status: item.status,
    createdAt: item.created_at,
    distance: undefined,
    isFavorite: true,
  }));

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
              currentSchoolId={listing.schoolId || ""}
            />
          ))}
        </div>
      )}
    </div>
  );
}
