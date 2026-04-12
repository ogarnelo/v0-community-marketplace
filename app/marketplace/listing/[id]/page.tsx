import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GraduationCap, MapPin, Star, Tag, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getNormalizedListingType } from "@/lib/marketplace/listing-type";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContactSellerButton } from "@/components/messages/contact-seller-button";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { ReportListingButton } from "@/components/marketplace/report-listing-button";
import { ListingViewTracker } from "@/components/marketplace/listing-view-tracker";
import { MakeOfferButton } from "@/components/marketplace/make-offer-button";
import { RequestDonationButton } from "@/components/marketplace/request-donation-button";
import { BuyNowButton } from "@/components/marketplace/buy-now-button";
import { ListingGallery } from "@/components/marketplace/listing-gallery";
import { ShareListingButton } from "@/components/marketplace/share-listing-button";
import { BuyerProtectionCard } from "@/components/payments/buyer-protection-card";
import type {
  ListingPhotoRow,
  ListingRow,
  ProfileRow,
  ReviewRow,
} from "@/lib/types/marketplace";
import {
  formatPrice,
  getConditionLabel,
  getInitials,
  getStatusBadgeClass,
  getStatusLabel,
  getUserTypeLabel,
} from "@/lib/marketplace/formatters";

type RelatedListingRow = {
  id: string;
  title: string | null;
  category: string | null;
  grade_level: string | null;
  price: number | null;
  type: string | null;
  listing_type?: string | null;
  status: string | null;
};

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: listing, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .single<ListingRow>();

  if (error || !listing) {
    notFound();
  }

  const { data: listingPhotos } = await supabase
    .from("listing_photos")
    .select("id, listing_id, url, sort_order")
    .eq("listing_id", listing.id)
    .order("sort_order", { ascending: true })
    .returns<ListingPhotoRow[]>();

  const photoUrls = (listingPhotos || []).map((photo) => photo.url);
  const sellerId = listing.seller_id || listing.user_id || null;

  let sellerProfile: ProfileRow | null = null;

  if (sellerId) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, user_type")
      .eq("id", sellerId)
      .maybeSingle<ProfileRow>();

    sellerProfile = data;
  }

  let sellerRating: number | null = null;
  let sellerReviewCount = 0;

  if (sellerId) {
    const { data: ratingData } = await supabase
      .from("reviews")
      .select("rating")
      .eq("reviewed_user_id", sellerId)
      .returns<ReviewRow[]>();

    if (ratingData && ratingData.length > 0) {
      sellerReviewCount = ratingData.length;
      sellerRating =
        ratingData.reduce((sum, review) => sum + review.rating, 0) /
        ratingData.length;
    }
  }

  const { data: relatedListings } = await supabase
    .from("listings")
    .select("id, title, category, grade_level, price, type, listing_type, status")
    .neq("id", listing.id)
    .eq("status", "available")
    .or(`category.eq.${listing.category},grade_level.eq.${listing.grade_level}`)
    .limit(3)
    .returns<RelatedListingRow[]>();

  let isFavorite = false;

  if (user) {
    const { data: favoriteRow } = await supabase
      .from("favorites")
      .select("user_id, listing_id")
      .eq("user_id", user.id)
      .eq("listing_id", listing.id)
      .maybeSingle();

    isFavorite = !!favoriteRow;
  }

  const title = listing.title || "Anuncio sin título";
  const description = listing.description || "Sin descripción";
  const category = listing.category || "Sin categoría";
  const gradeLevel = listing.grade_level || "Sin curso";
  const condition = getConditionLabel(listing.condition);
  const type = getNormalizedListingType(listing);
  const price = listing.price;
  const originalPrice = listing.original_price || listing.estimated_retail_price;
  const postalCode = listing.postal_code;
  const status = listing.status || "available";
  const isbn = listing.isbn?.trim() || null;
  const isOwner = !!user && !!sellerId && user.id === sellerId;
  const canStartNewInteraction = status === "available" && !isOwner && !!sellerId;
  const savings = price != null && originalPrice && originalPrice > price ? originalPrice - price : 0;

  const sellerName = sellerProfile?.full_name || "Miembro de Wetudy";
  const sellerUserType =
    sellerProfile?.user_type === "parent" || sellerProfile?.user_type === "student"
      ? getUserTypeLabel(sellerProfile.user_type)
      : sellerProfile?.user_type === "business"
        ? "Negocio local"
        : "Usuario";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <ListingViewTracker listingId={listing.id} />

      <div className="mb-6">
        <Link href="/marketplace">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al marketplace
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ListingGallery title={title} category={category} photoUrls={photoUrls} />

          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge variant="secondary">{category}</Badge>
              <Badge variant="outline">{condition}</Badge>
              <Badge variant="outline" className={getStatusBadgeClass(status)}>
                {getStatusLabel(status)}
              </Badge>
              {type === "donation" ? <Badge>Donación</Badge> : null}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-3xl font-bold tracking-tight">{title}</h1>

                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    <span>{gradeLevel}</span>
                  </div>

                  {postalCode ? (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{postalCode}</span>
                    </div>
                  ) : null}

                  {isbn ? <span>ISBN: {isbn}</span> : null}
                </div>
              </div>

              <div className="shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <FavoriteButton
                    listingId={listing.id}
                    initialIsFavorite={isFavorite}
                    showLabel
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-[#7EBA28] hover:text-[#7EBA28]"
                    iconClassName="h-4 w-4"
                  />
                  <ShareListingButton title={title} />
                  <ReportListingButton listingId={listing.id} compact />
                </div>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Descripción</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </CardContent>
          </Card>

          <BuyerProtectionCard />

          <Card>
            <CardHeader>
              <CardTitle>Otros productos recomendados</CardTitle>
              <CardDescription>Anuncios similares dentro del marketplace.</CardDescription>
            </CardHeader>
            <CardContent>
              {!relatedListings || relatedListings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay otros productos relacionados.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {relatedListings.map((item) => (
                    <Link
                      key={item.id}
                      href={`/marketplace/listing/${item.id}`}
                      className="rounded-xl border p-4 transition hover:bg-muted/40"
                    >
                      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                        {item.category || "Sin categoría"}
                      </div>
                      <div className="line-clamp-2 text-sm font-semibold">{item.title}</div>
                      <div className="mt-2 text-xs text-muted-foreground">{item.grade_level || "Sin curso"}</div>
                      <div className="mt-3 font-semibold">
                        {getNormalizedListingType(item) === "donation"
                          ? "Gratis"
                          : item.price != null
                            ? formatPrice(item.price)
                            : "Consultar"}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Tag className="h-4 w-4" />
                Precio
              </div>

              {type === "donation" ? (
                <p className="text-3xl font-bold text-primary">Donación</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end gap-3">
                    <p className="text-3xl font-bold">{price != null ? formatPrice(price) : "Consultar"}</p>
                    {originalPrice ? (
                      <p className="text-sm text-muted-foreground line-through">{formatPrice(originalPrice)}</p>
                    ) : null}
                  </div>
                  {savings > 0 ? (
                    <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                      Ahorras {formatPrice(savings)} frente al precio original
                    </div>
                  ) : null}
                </div>
              )}

              {sellerId && canStartNewInteraction ? (
                <div className="mt-6 space-y-3">
                  {type === "sale" ? (
                    <>
                      <BuyNowButton listingId={listing.id} currentPrice={price} />
                      <MakeOfferButton listingId={listing.id} currentPrice={price} />
                      <ContactSellerButton listingId={listing.id} sellerId={sellerId} />
                    </>
                  ) : (
                    <>
                      <RequestDonationButton listingId={listing.id} />
                      <ContactSellerButton listingId={listing.id} sellerId={sellerId} />
                    </>
                  )}
                </div>
              ) : (
                <Button size="lg" className="mt-6 w-full" disabled>
                  {isOwner
                    ? "Este anuncio es tuyo"
                    : status === "reserved"
                      ? "Anuncio reservado"
                      : status === "sold"
                        ? "Anuncio vendido"
                        : "Anuncio archivado"}
                </Button>
              )}

              {type === "sale" ? (
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  Para mantener la compra protegida y trazable, cierra el pago dentro de Wetudy cuando el vendedor acepte la operación.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vendedor</CardTitle>
              <CardDescription>Información pública del perfil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link
                href={sellerId ? `/profile/${sellerId}` : "#"}
                className={`block rounded-2xl transition ${sellerId ? "hover:bg-muted/40" : ""}`}
              >
                <div className="flex items-center gap-3 rounded-2xl p-2">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>{getInitials(sellerName, null)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{sellerName}</p>
                    <p className="text-sm text-muted-foreground">{sellerUserType}</p>
                  </div>
                </div>
              </Link>

              <div className="rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Star className="h-4 w-4" />
                  Valoración
                </div>

                {sellerRating ? (
                  <p className="text-sm text-muted-foreground">⭐ {sellerRating.toFixed(1)} ({sellerReviewCount} valoraciones)</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Este usuario aún no tiene valoraciones.</p>
                )}
              </div>

              <div className="rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" />
                  Perfil
                </div>
                <p className="text-sm text-muted-foreground">Miembro verificado de la comunidad Wetudy.</p>
              </div>

              {sellerId ? (
                <Link href={`/profile/${sellerId}`} className="block">
                  <Button variant="outline" className="w-full">
                    Ver perfil público
                  </Button>
                </Link>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalles del anuncio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Categoría</span>
                <span className="text-foreground">{category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Curso / etapa</span>
                <span className="text-foreground">{gradeLevel}</span>
              </div>
              {isbn ? (
                <div className="flex items-center justify-between gap-4">
                  <span>ISBN</span>
                  <span className="text-right text-foreground">{isbn}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span>Estado</span>
                <span className="text-foreground">{getStatusLabel(status)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tipo</span>
                <span className="text-foreground">{type === "donation" ? "Donación" : "Venta"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
