import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { getNormalizedListingType } from "@/lib/marketplace/listing-type";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MapPin,
  Star,
  User,
  Package,
  GraduationCap,
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
  getUserTypeLabel,
} from "@/lib/marketplace/formatters";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const navbarData = await getNavbarData(supabase);


  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, user_type, grade_level, postal_code")
    .eq("id", id)
    .maybeSingle();

  const typedProfile = (profile as ProfileRow | null) ?? null;

  if (profileError || !typedProfile) {
    notFound();
  }

  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating, comment, created_at")
    .eq("reviewed_user_id", id)
    .order("created_at", { ascending: false });

  const { data: activeListingsData } = await supabase
    .from("listings")
    .select(
      "id, title, category, grade_level, condition, type, listing_type, price, status, created_at"
    )
    .eq("seller_id", id)
    .eq("status", "available")
    .order("created_at", { ascending: false });

  const activeListings = (activeListingsData || []) as ListingRow[];
  const activeListingIds = activeListings.map((listing) => listing.id);

  const firstPhotoMap = new Map<string, string>();

  if (activeListingIds.length > 0) {
    const { data: photosData } = await supabase
      .from("listing_photos")
      .select("id, listing_id, url, sort_order")
      .in("listing_id", activeListingIds)
      .order("sort_order", { ascending: true });

    for (const photo of (photosData || []) as ListingPhotoRow[]) {
      if (!firstPhotoMap.has(photo.listing_id)) {
        firstPhotoMap.set(photo.listing_id, photo.url);
      }
    }
  }

  const typedReviews = (reviews || []) as ReviewRow[];

  const reviewCount = typedReviews.length;
  const averageRating =
    reviewCount > 0
      ? typedReviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
      : null;

  const sellerName =
    typedProfile.full_name && typedProfile.full_name.trim().length > 0
      ? typedProfile.full_name.trim()
      : "Miembro de Wetudy";

  const sellerUserType =
    typedProfile.user_type === "parent" || typedProfile.user_type === "student"
      ? getUserTypeLabel(typedProfile.user_type)
      : "Miembro de Wetudy";

  const sellerPostalCode = typedProfile.postal_code || null;
  const sellerGradeLevel = typedProfile.grade_level || null;

  return (
    <>
      <Navbar
        isLoggedIn={navbarData.isLoggedIn}
        userName={navbarData.userName}
        currentUserId={navbarData.currentUserId}
        unreadMessagesCount={navbarData.unreadMessagesCount}
        isAdmin={navbarData.isAdmin}
      />

      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
        <div className="mb-6">
          <Link href="/marketplace">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al marketplace
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-lg">
                      {getInitials(sellerName)}
                    </AvatarFallback>
                  </Avatar>

                  <h1 className="mt-4 text-2xl font-bold">{sellerName}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {sellerUserType}
                  </p>

                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Badge variant="secondary">Perfil p√∫blico</Badge>
                    <Badge variant="outline">Miembro Wetudy</Badge>
                  </div>
                </div>

                <div className="mt-6 space-y-3 rounded-2xl border p-4">
                  {sellerPostalCode ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{sellerPostalCode}</span>
                    </div>
                  ) : null}

                  {sellerGradeLevel ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GraduationCap className="h-4 w-4" />
                      <span>{sellerGradeLevel}</span>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Perfil verificado en Wetudy</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Confianza del vendedor</CardTitle>
                <CardDescription>
                  Informaci√≥n p√∫blica visible para otros usuarios.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-2xl border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Star className="h-4 w-4" />
                    Valoraci√≥n media
                  </div>
                  <p className="text-2xl font-bold">
                    {averageRating ? averageRating.toFixed(1) : "‚Äî"}
                  </p>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="mb-2 text-sm font-medium">Valoraciones</div>
                  <p className="text-2xl font-bold">{reviewCount}</p>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4" />
                    Anuncios activos
                  </div>
                  <p className="text-2xl font-bold">{activeListings.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Anuncios activos</CardTitle>
                <CardDescription>
                  Material que este vendedor tiene disponible ahora mismo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeListings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este usuario no tiene anuncios activos en este momento.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {activeListings.map((listing) => {
                      const firstPhoto = firstPhotoMap.get(listing.id) || null;
                      const isDonation = getNormalizedListingType(listing) === "donation";

                      return (
                        <Link
                          key={listing.id}
                          href={`/marketplace/listing/${listing.id}`}
                          className="overflow-hidden rounded-2xl border transition hover:bg-muted/40"
                        >
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

                          <div className="p-4">
                            <div className="mb-3 flex flex-wrap gap-2">
                              <Badge variant="secondary">
                                {listing.category || "Sin categor√≠a"}
                              </Badge>
                              <Badge variant="outline">
                                {getConditionLabel(listing.condition)}
                              </Badge>
                            </div>

                            <h3 className="line-clamp-2 font-semibold">
                              {listing.title || "Anuncio sin t√≠tulo"}
                            </h3>

                            <div className="mt-2 text-sm text-muted-foreground">
                              {listing.grade_level || "Sin curso"}
                            </div>

                            <div className="mt-4 text-lg font-bold">
                              {isDonation
                                ? "Gratis"
                                : listing.price != null
                                  ? `${listing.price}‚Ç¨`
                                  : "Consultar"}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Opiniones recibidas</CardTitle>
                <CardDescription>
                  Valoraciones p√∫blicas de otros usuarios.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {typedReviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este usuario todav√≠a no tiene valoraciones.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {typedReviews.slice(0, 6).map((review, index) => (
                      <div key={index} className="rounded-2xl border p-4">
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <p className="text-sm font-medium">
                            {"‚≠ê".repeat(review.rating)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {review.created_at
                              ? new Date(review.created_at).toLocaleDateString(
                                "es-ES",
                                {
                                  timeZone: "Europe/Madrid",
                                }
                              )
                              : ""}
                          </p>
                        </div>

                        <p className="text-sm text-muted-foreground">
                          {review.comment?.trim()
                            ? review.comment
                            : "Sin comentario adicional."}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

