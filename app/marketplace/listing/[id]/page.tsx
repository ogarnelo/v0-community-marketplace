import { ContactSellerButton } from "@/components/messages/contact-seller-button"
import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ArrowLeft, BookOpen, Tag, GraduationCap, MapPin, User, Star } from "lucide-react"

function conditionLabel(value?: string | null) {
  switch (value) {
    case "new_with_tags":
      return "Nuevo con etiquetas"
    case "new_without_tags":
      return "Nuevo sin etiquetas"
    case "very_good":
      return "Muy bueno"
    case "good":
      return "Bueno"
    case "satisfactory":
      return "Satisfactorio"
    default:
      return value || "Sin estado"
  }
}

function getInitials(name?: string | null, email?: string | null) {
  if (name && name.trim().length > 0) {
    return name
      .trim()
      .split(" ")
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join("")
  }

  if (email && email.length > 0) {
    return email[0].toUpperCase()
  }

  return "U"
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: listing, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !listing) {
    notFound()
  }

  const sellerId = listing.seller_id || listing.user_id || null

  let sellerProfile: any = null
  if (sellerId) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", sellerId)
      .maybeSingle()

    sellerProfile = data
  }
  let sellerRating: number | null = null
  let sellerReviewCount = 0

  if (sellerId) {
    const { data: ratingData } = await supabase
      .from("reviews")
      .select("rating")
      .eq("reviewed_user_id", sellerId)

    if (ratingData && ratingData.length > 0) {
      sellerReviewCount = ratingData.length
      sellerRating =
        ratingData.reduce((sum, review) => sum + review.rating, 0) /
        ratingData.length
    }
  }
  const { data: relatedListings } = await supabase
    .from("listings")
    .select("id, title, category, grade_level, price, type, status")
    .neq("id", listing.id)
    .eq("status", "available")
    .or(`category.eq.${listing.category},grade_level.eq.${listing.grade_level}`)
    .limit(3)

  const title = listing.title || "Anuncio sin título"
  const description = listing.description || "Sin descripción"
  const category = listing.category || "Sin categoría"
  const gradeLevel = listing.grade_level || "Sin curso"
  const condition = conditionLabel(listing.condition)
  const type = listing.type || listing.listing_type || "sale"
  const price = listing.price
  const originalPrice = listing.original_price || listing.estimated_retail_price
  const postalCode = listing.postal_code

  const sellerName =
    sellerProfile?.full_name ||
    "Miembro de Wetudy"

  const sellerUserType =
    sellerProfile?.user_type === "parent"
      ? "Familia / Tutor legal"
      : sellerProfile?.user_type === "student"
        ? "Estudiante"
        : "Usuario"

  return (
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
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex aspect-[4/3] items-center justify-center bg-muted">
              <span className="select-none font-mono text-7xl text-muted-foreground/15">
                {category.charAt(0)}
              </span>
            </div>
          </Card>

          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge variant="secondary">{category}</Badge>
              <Badge variant="outline">{condition}</Badge>
              {type === "donation" && <Badge>Donación</Badge>}
            </div>

            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                <span>{gradeLevel}</span>
              </div>

              {postalCode && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{postalCode}</span>
                </div>
              )}
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
                  {originalPrice && (
                    <p className="text-sm text-muted-foreground line-through">
                      {originalPrice}€
                    </p>
                  )}
                </div>
              )}

              {sellerId ? (
                <ContactSellerButton listingId={listing.id} sellerId={sellerId} />
              ) : (
                <Button size="lg" className="mt-6 w-full" disabled>
                  Contactar
                </Button>
              )}
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
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    {getInitials(sellerName, null)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{sellerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {sellerUserType}
                  </p>
                </div>
              </div>

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
                <span className="text-foreground">{condition}</span>
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
  )
}