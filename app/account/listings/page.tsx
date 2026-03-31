import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Package } from "lucide-react";
import { ListingStatusActions } from "@/components/account/listing-status-actions";
import type { ListingPhotoRow, ListingRow } from "@/lib/types/marketplace";
import {
  formatPrice,
  getStatusBadgeClass,
  getStatusLabel,
} from "@/lib/marketplace/formatters";
import { getListingTypeFromRow } from "@/lib/marketplace/listing-type";

export default async function MyListingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: listingsData } = await supabase
    .from("listings")
    .select("id, title, category, price, type, listing_type, status")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  const listings = (listingsData || []) as ListingRow[];
  const listingIds = listings.map((listing) => listing.id);

  const firstPhotoMap = new Map<string, string>();

  if (listingIds.length > 0) {
    const { data: photosData } = await supabase
      .from("listing_photos")
      .select("id, listing_id, url, sort_order")
      .in("listing_id", listingIds)
      .order("sort_order", { ascending: true });

    for (const photo of (photosData || []) as ListingPhotoRow[]) {
      if (!firstPhotoMap.has(photo.listing_id)) {
        firstPhotoMap.set(photo.listing_id, photo.url);
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis anuncios</h1>
          <p className="text-muted-foreground">
            Gestiona los art√≠culos que has publicado en Wetudy.
          </p>
        </div>

        <Button asChild className="gap-2">
          <Link href="/marketplace/new">
            <Plus className="h-4 w-4" />
            Publicar anuncio
          </Link>
        </Button>
      </div>

      {listings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">A√∫n no has publicado nada</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Publica tu primer art√≠culo para empezar a reutilizar material escolar.
            </p>

            <Button asChild className="mt-6">
              <Link href="/marketplace/new">Crear primer anuncio</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => {
            const firstPhoto = firstPhotoMap.get(listing.id) || null;
            const isDonation = getListingTypeFromRow(listing) === "donation";

            return (
              <Card key={listing.id} className="overflow-hidden transition hover:shadow-lg">
                <div
                  className="flex items-center justify-center bg-muted"
                  style={{ aspectRatio: "4 / 3" }}
                >
                  {firstPhoto ? (
                    <img
                      src={firstPhoto}
                      alt={listing.title || "Anuncio"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="select-none font-mono text-5xl text-muted-foreground/15">
                      {(listing.category || "A").charAt(0)}
                    </span>
                  )}
                </div>

                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="line-clamp-2 text-base">
                        <Link href={`/marketplace/listing/${listing.id}`}>
                          {listing.title || "Anuncio sin t√≠tulo"}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        {listing.category || "Sin categor√≠a"}
                      </CardDescription>
                    </div>

                    <Badge
                      variant="outline"
                      className={getStatusBadgeClass(listing.status)}
                    >
                      {getStatusLabel(listing.status)}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      {isDonation ? (
                        <Badge>Donaci√≥n</Badge>
                      ) : listing.price != null ? (
                        <span className="font-semibold">{formatPrice(listing.price)}</span>
                      ) : (
                        <span className="font-semibold">Consultar</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm" className="gap-2">
                        <Link href={`/marketplace/edit/${listing.id}`}>
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Link>
                      </Button>

                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/marketplace/listing/${listing.id}`}>Ver anuncio</Link>
                      </Button>
                    </div>
                  </div>

                  <ListingStatusActions
                    listingId={listing.id}
                    currentStatus={listing.status}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

