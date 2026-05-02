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
import FollowUserButton from "@/components/profile/follow-user-button";
import { displayExternalUrl, safeExternalUrl } from "@/lib/security/safe-url";

export const dynamic = "force-dynamic";

async function loadProfile(supabase: any, id: string) {
  const extended = await supabase
    .from("profiles")
    .select(
      "id, full_name, user_type, grade_level, postal_code, business_name, business_description, website, is_business_verified"
    )
    .eq("id", id)
    .maybeSingle();

  if (!extended.error) return extended;

  const base = await supabase
    .from("profiles")
    .select("id, full_name, user_type, grade_level, postal_code")
    .eq("id", id)
    .maybeSingle();

  if (base.error || !base.data) return base;

  return {
    data: {
      ...base.data,
      business_name: null,
      business_description: null,
      website: null,
      is_business_verified: false,
    },
    error: null,
  };
}

async function loadActiveListings(supabase: any, id: string) {
  const bySeller = await supabase
    .from("listings")
    .select(
      "id, title, category, grade_level, condition, type, listing_type, price, status, created_at"
    )
    .eq("seller_id", id)
    .eq("status", "available")
    .order("created_at", { ascending: false });

  if (!bySeller.error) return (bySeller.data || []) as ListingRow[];

  const byUser = await supabase
    .from("listings")
    .select(
      "id, title, category, grade_level, condition, type, listing_type, price, status, created_at"
    )
    .eq("user_id", id)
    .eq("status", "available")
    .order("created_at", { ascending: false });

  return (byUser.data || []) as ListingRow[];
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const navbarData = await getNavbarData(supabase);
  const currentUserId = navbarData.currentUserId;

  const { data: profile, error: profileError } = await loadProfile(supabase, id);
  const typedProfile = (profile as ProfileRow | null) ?? null;

  if (profileError || !typedProfile) {
    notFound();
  }

  const stats = await getUserProfileStats(supabase, id);

  let initialFollowing = false;
  if (currentUserId && currentUserId !== id) {
    try {
      const { data: follow } = await supabase
        .from("user_follows")
        .select("follower_id")
        .eq("follower_id", currentUserId)
        .eq("following_id", id)
        .maybeSingle();
      initialFollowing = !!follow;
    } catch {
      initialFollowing = false;
    }
  }

  const activeListings = await loadActiveListings(supabase, id);
  const activeListingIds = activeListings.map((listing) => listing.id);

  const firstPhotoMap = new Map<string, string>();

  if (activeListingIds.length > 0) {
    try {
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
    } catch {
      // El perfil debe seguir funcionando aunque las fotos fallen.
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
  const safeWebsite = safeExternalUrl(typedProfile.website);
  const websiteLabel = displayExternalUrl(typedProfile.website);

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

      <main className="mx-auto max-w-6xl px-4 py-8 pb-24 lg:px-8 md:pb-8">
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
                  <p className="mt-1 text-sm text-muted-foreground">{sellerUserType}</p>

                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Badge variant="secondary">Perfil público</Badge>
                    {typedProfile.is_business_verified ? <Badge>Negocio verificado</Badge> : null}
                  </div>

                  {currentUserId && currentUserId !== id ? (
                    <div className="mt-4">
                      <FollowUserButton targetUserId={id} initialFollowing={initialFollowing} />
                    </div>
                  ) : null}
                </div>

                <UserBadgePills badges={badges} className="mt-4 justify-center" />

                <div className="mt-6 space-y-3 rounded-2xl border p-4">
                  {sellerPostalCode ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{sellerPostalCode}</span>
                    </div>
                  ) : null}

                  {typedProfile.user_type !== "business" && sellerGradeLevel ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GraduationCap className="h-4 w-4" />
                      <span>{sellerGradeLevel}</span>
                    </div>
                  ) : null}

                  {typedProfile.user_type === "business" && typedProfile.business_name ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BriefcaseBusiness className="h-4 w-4" />
                      <span>{typedProfile.business_name}</span>
                    </div>
                  ) : null}

                  {typedProfile.user_type === "business" && safeWebsite ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <a href={safeWebsite} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                        {websiteLabel || safeWebsite}
                      </a>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Perfil visible dentro de Wetudy</span>
                  </div>
                </div>

                {typedProfile.user_type === "business" && typedProfile.business_description ? (
                  <div className="mt-4 rounded-2xl border p-4 text-sm text-muted-foreground">
                    {typedProfile.business_description}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Confianza del vendedor</CardTitle>
                <CardDescription>
                  Información pública visible para otros usuarios.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-2xl border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Star className="h-4 w-4" />
                    Valoración media
                  </div>
                  <p className="text-2xl font-bold">
                    {typeof stats.averageRating === "number" ? stats.averageRating.toFixed(1) : "—"}
                  </p>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="mb-2 text-sm font-medium">Valoraciones</div>
                  <p className="text-2xl font-bold">{stats.reviewCount}</p>
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

                          <div className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="line-clamp-2 font-semibold">
                                  {listing.title || "Anuncio sin título"}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {listing.category || "Sin categoría"}
                                </p>
                              </div>
                              <Badge variant={isDonation ? "secondary" : "outline"}>
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
      </main>
    </>
  );
}
