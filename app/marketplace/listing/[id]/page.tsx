import { ContactSellerButton } from "@/components/messages/contact-seller-button";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { ReportListingButton } from "@/components/marketplace/report-listing-button";
import { ListingViewTracker } from "@/components/marketplace/listing-view-tracker";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
import {
  ArrowLeft,
  Tag,
  GraduationCap,
  MapPin,
  User,
  Star,
} from "lucide-react";
import type {
  ListingPhotoRow,
  ListingRow,
  ProfileRow,
  ReviewRow,
} from "@/lib/types/marketplace";
import {
  getConditionLabel,
  getInitials,
  getStatusBadgeClass,
  getStatusLabel,
  getUserTypeLabel,
} from "@/lib/marketplace/formatters";
import { getNormalizedListingType } from "@/lib/marketplace/listing-type";

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
  const mainPhotoUrl = photoUrls[0] || null;

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

  const sellerName = sellerProfile?.full_name || "Miembro de Wetudy";
  const sellerUserType =
    sellerProfile?.user_type === "parent" ||
      sellerProfile?.user_type === "student"
      ? getUserTypeLabel(sellerProfile.user_type)
      : "Usuario";

  const canContact = status === "available";

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
          <Card className="overflow-hidden">
            <div
              className="flex items-center justify-center bg-muted"
              style={{ aspectRatio: "4 / 3" }}
            >
              {mainPhotoUrl ? (
                <img
                  src={mainPhotoUrl}
                  alt={title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="select-none font-mono text-7xl text-muted-foreground/15">
                  {category.charAt(0)}
                </span>
              )}
            </div>
          </Card>

          {photoUrls.length > 1 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photoUrls.slice(1).map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="overflow-hidden rounded-xl border bg-muted"
                >
                  <div style={{ aspectRatio: "4 / 3" }}>
                    <img
                      src={url}
                      alt={`${title} ${index + 2}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

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
                </div>
              </div>

              <div className="shrink-0">
                <FavoriteButton
                  listingId={listing.id}
                  initialIsFavorite={isFavorite}
                  showLabel
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-[#7EBA28] hover:text-[#7EBA28]"
                  iconClassName="h-4 w-4"
                />
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Descripción</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Otros productos recomendados</CardTitle>
              <CardDescription>
                Anuncios similares dentro del marketplace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!relatedListings || relatedListings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aún no hay otros productos relacionados.
                </p>
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
                      <div className="line-clamp-2 text-sm font-semibold">
                        {item.title}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {item.grade_level || "Sin curso"}
                      </div>
                      <div className="mt-3 font-semibold">
                        {(item.type || "sale") === "donation"
                          ? "Gratis"
                          : item.price != null
                            ? `${item.price}€`
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
                <p className="text-3xl font-bold text-primary">Gratis</p>
              ) : (
                <div className="flex items-end gap-3">
                  <p className="text-3xl font-bold">{price}€</p>
                  {originalPrice ? (
                    <p className="text-sm text-muted-foreground line-through">
                      {originalPrice}€
                    </p>
                  ) : null}
                </div>
              )}

              {canContact && sellerId ? (
                <ContactSellerButton listingId={listing.id} sellerId={sellerId} />
              ) : (
                <Button size="lg" className="mt-6 w-full" disabled>
                  {status === "reserved"
                    ? "Anuncio reservado"
                    : status === "sold"
                      ? "Anuncio vendido"
                      : "Anuncio archivado"}
                </Button>
              )}

              <div className="mt-3">
                <ReportListingButton listingId={listing.id} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vendedor</CardTitle>
              <CardDescription>
                Información pública del perfil.
              </CardDescription>
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
                    <p className="text-sm text-muted-foreground">
                      {sellerUserType}
                    </p>
                  </div>
                </div>
              </Link>

              <div className="rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Star className="h-4 w-4" />
                  Valoración
                </div>

                {sellerRating ? (
                  <p className="text-sm text-muted-foreground">
                    ⭐ {sellerRating.toFixed(1)} ({sellerReviewCount} valoraciones)
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Este usuario aún no tiene valoraciones.
                  </p>
                )}
              </div>

              <div className="rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" />
                  Perfil
                </div>
                <p className="text-sm text-muted-foreground">
                  Miembro verificado de la comunidad Wetudy.
                </p>
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
              <div className="flex items-center justify-between">
                <span>Estado</span>
                <span className="text-foreground">{getStatusLabel(status)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tipo</span>
                <span className="text-foreground">
                  {type === "donation" ? "Donación" : "Venta"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
