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
import { UserBadgePills } from "@/components/profile/user-badge-pills";
import {
  ArrowLeft,
  MapPin,
  Star,
  User,
  Package,
  GraduationCap,
  BriefcaseBusiness,
  Globe,
} from "lucide-react";
import type {
  ListingPhotoRow,
  ListingRow,
  ProfileRow,
} from "@/lib/types/marketplace";
import {
  getConditionLabel,
  getInitials,
  getUserTypeLabel,
} from "@/lib/marketplace/formatters";
import { getUserProfileStats } from "@/lib/users/get-user-profile-stats";

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
    .select(
      "id, full_name, user_type, grade_level, postal_code, business_name, business_description, website, is_business_verified"
    )
    .eq("id", id)
    .maybeSingle();

  const typedProfile = (profile as ProfileRow | null) ?? null;

  if (profileError || !typedProfile) {
    notFound();
  }

  const stats = await getUserProfileStats(supabase, id);

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

  const sellerName =
    typedProfile.business_name?.trim() ||
    typedProfile.full_name?.trim() ||
    "Miembro de Wetudy";
  const sellerUserType = getUserTypeLabel(typedProfile.user_type);
  const sellerPostalCode = typedProfile.postal_code || null;
  const sellerGradeLevel = typedProfile.grade_level || null;
  const badges = stats.badgesForUserType(typedProfile.user_type);

  return (
    <>
      <Navbar
        isLoggedIn={navbarData.isLoggedIn}
        userName={navbarData.userName}
        currentUserId={navbarData.currentUserId}
        unreadMessagesCount={navbarData.unreadMessagesCount}
        unreadNotificationsCount={navbarData.unreadNotificationsCount}
        notifications={navbarData.notifications}
        isAdmin={navbarData.isAdmin}
        isSuperAdmin={navbarData.isSuperAdmin}
        adminHref={navbarData.adminHref}
      />

      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-8 lg:px-8">
        <div className="mb-4 sm:mb-6">
          <Link href="/marketplace">
            <Button variant="ghost" className="h-10 gap-2 px-1 sm:px-3">
              <ArrowLeft className="h-4 w-4" />
              Volver al marketplace
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="space-y-4 sm:space-y-6 lg:col-span-1">
            <Card className="overflow-hidden gap-0 py-0 sm:gap-6 sm:py-6">
              <CardContent className="p-4 sm:px-6 sm:pb-6 sm:pt-0">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                    <AvatarFallback className="text-base sm:text-lg">
                      {getInitials(sellerName)}
                    </AvatarFallback>
                  </Avatar>

                  <h1 className="mt-3 text-xl font-bold sm:mt-4 sm:text-2xl">{sellerName}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{sellerUserType}</p>

                  <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:mt-4 sm:gap-2">
                    <Badge variant="secondary">Perfil público</Badge>
                    {typedProfile.is_business_verified ? <Badge>Negocio verificado</Badge> : null}
                  </div>
                </div>

                <UserBadgePills badges={badges} className="mt-3 justify-center sm:mt-4" />

                <div className="mt-4 space-y-2 rounded-2xl border p-3 sm:mt-6 sm:space-y-3 sm:p-4">
                  {sellerPostalCode ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>{sellerPostalCode}</span>
                    </div>
                  ) : null}

                  {typedProfile.user_type !== "business" && sellerGradeLevel ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GraduationCap className="h-4 w-4 shrink-0" />
                      <span>{sellerGradeLevel}</span>
                    </div>
                  ) : null}

                  {typedProfile.user_type === "business" && typedProfile.business_name ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BriefcaseBusiness className="h-4 w-4 shrink-0" />
                      <span>{typedProfile.business_name}</span>
                    </div>
                  ) : null}

                  {typedProfile.user_type === "business" && typedProfile.website ? (
                    <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                      <Globe className="h-4 w-4 shrink-0" />
                      <a href={typedProfile.website} target="_blank" rel="noreferrer" className="truncate hover:text-foreground">
                        {typedProfile.website}
                      </a>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4 shrink-0" />
                    <span>Perfil visible dentro de Wetudy</span>
                  </div>
                </div>

                {typedProfile.user_type === "business" && typedProfile.business_description ? (
                  <div className="mt-3 rounded-2xl border p-3 text-sm text-muted-foreground sm:mt-4 sm:p-4">
                    {typedProfile.business_description}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="gap-4 py-4 sm:gap-6 sm:py-6">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle>Confianza del vendedor</CardTitle>
                <CardDescription>
                  Información pública visible para otros usuarios.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-2 px-4 sm:gap-4 sm:px-6 lg:grid-cols-1">
                <div className="min-w-0 rounded-2xl border p-3 sm:p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium leading-tight sm:mb-2 sm:gap-2 sm:text-sm">
                    <Star className="h-4 w-4 shrink-0" />
                    <span>Valoración media</span>
                  </div>
                  <p className="text-xl font-bold sm:text-2xl">
                    {typeof stats.averageRating === "number" ? stats.averageRating.toFixed(1) : "—"}
                  </p>
                </div>

                <div className="min-w-0 rounded-2xl border p-3 sm:p-4">
                  <div className="mb-1.5 text-[11px] font-medium leading-tight sm:mb-2 sm:text-sm">Valoraciones</div>
                  <p className="text-xl font-bold sm:text-2xl">{stats.reviewCount}</p>
                </div>

                <div className="min-w-0 rounded-2xl border p-3 sm:p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium leading-tight sm:mb-2 sm:gap-2 sm:text-sm">
                    <Package className="h-4 w-4 shrink-0" />
                    <span>Anuncios activos</span>
                  </div>
                  <p className="text-xl font-bold sm:text-2xl">{activeListings.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 sm:space-y-6 lg:col-span-2">
            <Card className="gap-4 py-4 sm:gap-6 sm:py-6">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle>Anuncios activos</CardTitle>
                <CardDescription>
                  Material que este vendedor tiene disponible ahora mismo.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {activeListings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este usuario no tiene anuncios activos en este momento.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
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

                          <div className="space-y-2.5 p-3 sm:space-y-3 sm:p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="line-clamp-2 font-semibold">
                                  {listing.title || "Anuncio sin título"}
                                </h3>
                                <p className="truncate text-sm text-muted-foreground">
                                  {listing.category || "Sin categoría"}
                                </p>
                              </div>
                              <Badge className="shrink-0" variant={isDonation ? "secondary" : "outline"}>
                                {isDonation ? "Donación" : "Venta"}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="rounded-full bg-muted px-2 py-1">
                                {listing.grade_level || "Sin curso"}
                              </span>
                              <span className="rounded-full bg-muted px-2 py-1">
                                {getConditionLabel(listing.condition)}
                              </span>
                            </div>

                            <div className="text-lg font-bold">
                              {isDonation ? "Gratis" : `${listing.price || 0} €`}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
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
