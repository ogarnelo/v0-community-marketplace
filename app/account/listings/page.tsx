import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/server-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilePenLine, Pencil, Plus, Package } from "lucide-react";
import { ListingStatusActions } from "@/components/account/listing-status-actions";
import { DeleteListingButton } from "@/components/account/delete-listing-button";
import { DiscardListingDraftButton } from "@/components/account/discard-listing-draft-button";
import { ListingOffersPanel, type SellerOfferItem } from "@/components/account/listing-offers-panel";
import type { ListingOfferRow, ListingPhotoRow, ListingRow, ProfileRow } from "@/lib/types/marketplace";
import {
  formatPrice,
  getStatusBadgeClass,
  getStatusLabel,
} from "@/lib/marketplace/formatters";
import { getListingTypeFromRow } from "@/lib/marketplace/listing-type";
import { draftDisplayTitle, type ListingDraftPayload } from "@/lib/marketplace/listing-draft";

export default async function MyListingsPage() {
  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth?next=/account/listings");
  }

  const [{ data: listingsData }, { data: draftData }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, title, category, price, type, listing_type, status")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("listing_drafts")
      .select("payload, photos, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const listings = (listingsData || []) as ListingRow[];
  const draftPayload = (draftData?.payload || null) as Partial<ListingDraftPayload> | null;
  const draftPhotos = Array.isArray(draftData?.photos) ? draftData.photos : [];
  const draftUpdatedAt = draftData?.updated_at
    ? new Date(draftData.updated_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })
    : null;
  const listingIds = listings.map((listing) => listing.id);
  const admin = createAdminClient();

  const firstPhotoMap = new Map<string, string>();
  let sellerOffers: SellerOfferItem[] = [];

  if (listingIds.length > 0) {
    const [{ data: photosData }, { data: offersData }] = await Promise.all([
      supabase
        .from("listing_photos")
        .select("id, listing_id, url, sort_order")
        .in("listing_id", listingIds)
        .order("sort_order", { ascending: true }),
      supabase
        .from("listing_offers")
        .select("id, listing_id, buyer_id, seller_id, offered_price, status, counter_price, created_at, responded_at")
        .in("listing_id", listingIds)
        .order("created_at", { ascending: false }),
    ]);

    for (const photo of (photosData || []) as ListingPhotoRow[]) {
      if (!firstPhotoMap.has(photo.listing_id)) {
        firstPhotoMap.set(photo.listing_id, photo.url);
      }
    }

    const offers = (offersData || []) as ListingOfferRow[];
    const buyerIds = Array.from(new Set(offers.map((offer) => offer.buyer_id)));

    let profilesMap = new Map<string, ProfileRow>();

    if (buyerIds.length > 0) {
      const { data: buyersData } = await admin
        .from("profiles")
        .select("id, full_name")
        .in("id", buyerIds);

      profilesMap = new Map(
        ((buyersData || []) as ProfileRow[]).map((profile) => [profile.id, profile])
      );
    }

    sellerOffers = offers.map((offer) => ({
      id: offer.id,
      listingId: offer.listing_id,
      buyerId: offer.buyer_id,
      buyerName: profilesMap.get(offer.buyer_id)?.full_name?.trim() || "Comprador",
      offeredPrice: offer.offered_price,
      status: offer.status,
      counterPrice: offer.counter_price,
      createdAt: offer.created_at,
    }));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis anuncios</h1>
          <p className="text-muted-foreground">
            Gestiona los artículos que has publicado en Wetudy.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/account/activity">Actividad</Link>
          </Button>
          <Button asChild className="gap-2">
            <Link href="/marketplace/new">
              <Plus className="h-4 w-4" />
              Publicar anuncio
            </Link>
          </Button>
        </div>
      </div>

      {draftData ? (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
                <FilePenLine className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Borrador guardado</p>
                <h2 className="mt-1 truncate font-semibold">{draftDisplayTitle(draftPayload)}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {draftPhotos.length > 0 ? `${draftPhotos.length} foto${draftPhotos.length === 1 ? "" : "s"} · ` : ""}
                  {draftUpdatedAt ? `Actualizado ${draftUpdatedAt}` : "Listo para continuar"}
                </p>
              </div>
            </div>
            <div className="grid w-full gap-2 sm:w-auto sm:min-w-[190px]">
              <Button asChild>
                <Link href="/marketplace/new">Continuar borrador</Link>
              </Button>
              <DiscardListingDraftButton />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {listings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">Aún no has publicado nada</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Publica tu primer artículo para empezar a reutilizar material escolar.
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
                <div className="flex items-center justify-center bg-muted" style={{ aspectRatio: "4 / 3" }}>
                  {firstPhoto ? (
                    <img src={firstPhoto} alt={listing.title || "Anuncio"} className="h-full w-full object-cover" />
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
                          {listing.title || "Anuncio sin título"}
                        </Link>
                      </CardTitle>
                      <CardDescription>{listing.category || "Sin categoría"}</CardDescription>
                    </div>

                    <Badge variant="outline" className={getStatusBadgeClass(listing.status)}>
                      {getStatusLabel(listing.status)}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    {isDonation ? (
                      <Badge>Donación</Badge>
                    ) : listing.price != null ? (
                      <span className="text-lg font-semibold">{formatPrice(listing.price)}</span>
                    ) : (
                      <span className="font-semibold">Consultar</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" size="sm" className="w-full gap-2">
                      <Link href={`/marketplace/edit/${listing.id}`}>
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Link>
                    </Button>

                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={`/marketplace/listing/${listing.id}`}>Ver anuncio</Link>
                    </Button>
                  </div>

                  <ListingStatusActions listingId={listing.id} currentStatus={listing.status} />

                  <div className="border-t pt-3">
                    <DeleteListingButton
                      listingId={listing.id}
                      title={listing.title}
                      className="w-full justify-center border-red-200 bg-red-50/60 hover:bg-red-50"
                    />
                  </div>

                  {!isDonation ? <ListingOffersPanel listingId={listing.id} offers={sellerOffers} /> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
