import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

function getInitials(name?: string | null) {
  if (!name || !name.trim()) return "U";

  return name
    .trim()
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

function getUserTypeLabel(userType?: string | null) {
  switch (userType) {
    case "parent":
      return "Familia / Tutor legal";
    case "student":
      return "Estudiante";
    default:
      return "Miembro de Wetudy";
  }
}

function getConditionLabel(value?: string | null) {
  switch (value) {
    case "new_with_tags":
      return "Nuevo con etiquetas";
    case "new_without_tags":
      return "Nuevo sin etiquetas";
    case "very_good":
      return "Muy bueno";
    case "good":
      return "Bueno";
    case "satisfactory":
      return "Satisfactorio";
    default:
      return value || "Sin estado";
  }
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let navbarUserName = "Mi cuenta";
  let unreadMessagesCount = 0;
  let isAdmin = false;

  if (user) {
    const [{ data: currentProfile }, { count: unreadCountResult }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, user_type")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .neq("sender_id", user.id)
          .is("read_at", null),
      ]);

    navbarUserName =
      currentProfile?.full_name?.trim() ||
      user.user_metadata?.full_name ||
      user.email ||
      "Mi cuenta";

    isAdmin =
      currentProfile?.user_type === "school_admin" ||
      currentProfile?.user_type === "super_admin";

    unreadMessagesCount = unreadCountResult || 0;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, user_type, grade_level, postal_code")
    .eq("id", id)
    .maybeSingle();

  if (profileError || !profile) {
    notFound();
  }

  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating, comment, created_at")
    .eq("reviewed_user_id", id)
    .order("created_at", { ascending: false });

  const { data: activeListings } = await supabase
    .from("listings")
    .select(
      "id, title, category, grade_level, condition, type, price, status, created_at"
    )
    .eq("seller_id", id)
    .eq("status", "available")
    .order("created_at", { ascending: false });

  const reviewCount = reviews?.length || 0;
  const averageRating =
    reviewCount > 0
      ? reviews!.reduce((sum, review) => sum + review.rating, 0) / reviewCount
      : null;

  const sellerName =
    profile.full_name && profile.full_name.trim().length > 0
      ? profile.full_name.trim()
      : "Miembro de Wetudy";

  const sellerUserType = getUserTypeLabel(profile.user_type);
  const sellerPostalCode = profile.postal_code || null;
  const sellerGradeLevel = profile.grade_level || null;

  return (
    <>
      <Navbar
        isLoggedIn={!!user}
        userName={navbarUserName}
        currentUserId={user?.id}
        unreadMessagesCount={unreadMessagesCount}
        isAdmin={isAdmin}
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
                    <Badge variant="secondary">Perfil público</Badge>
                    <Badge variant="outline">Miembro Wetudy</Badge>
                  </div>
                </div>

                <div className="mt-6 space-y-3 rounded-2xl border p-4">
                  {sellerPostalCode && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{sellerPostalCode}</span>
                    </div>
                  )}

                  {sellerGradeLevel && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GraduationCap className="h-4 w-4" />
                      <span>{sellerGradeLevel}</span>
                    </div>
                  )}

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
                    {averageRating ? averageRating.toFixed(1) : "—"}
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
                  <p className="text-2xl font-bold">
                    {activeListings?.length || 0}
                  </p>
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
                {!activeListings || activeListings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este usuario no tiene anuncios activos en este momento.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {activeListings.map((listing) => (
                      <Link
                        key={listing.id}
                        href={`/marketplace/listing/${listing.id}`}
                        className="rounded-2xl border p-4 transition hover:bg-muted/40"
                      >
                        <div className="mb-3 flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            {listing.category || "Sin categoría"}
                          </Badge>
                          <Badge variant="outline">
                            {getConditionLabel(listing.condition)}
                          </Badge>
                        </div>

                        <h3 className="line-clamp-2 font-semibold">
                          {listing.title || "Anuncio sin título"}
                        </h3>

                        <div className="mt-2 text-sm text-muted-foreground">
                          {listing.grade_level || "Sin curso"}
                        </div>

                        <div className="mt-4 text-lg font-bold">
                          {(listing.type || "sale") === "donation"
                            ? "Gratis"
                            : listing.price != null
                              ? `${listing.price}€`
                              : "Consultar"}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Opiniones recibidas</CardTitle>
                <CardDescription>
                  Valoraciones públicas de otros usuarios.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!reviews || reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este usuario todavía no tiene valoraciones.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {reviews.slice(0, 6).map((review, index) => (
                      <div key={index} className="rounded-2xl border p-4">
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <p className="text-sm font-medium">
                            {"⭐".repeat(review.rating)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString(
                              "es-ES",
                              {
                                timeZone: "Europe/Madrid",
                              }
                            )}
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
