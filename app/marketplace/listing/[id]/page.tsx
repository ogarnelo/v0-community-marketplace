import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, BookOpen, Tag, GraduationCap, MapPin } from "lucide-react"

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

  const title = listing.title || "Anuncio sin título"
  const description = listing.description || "Sin descripción"
  const category = listing.category || "Sin categoría"
  const gradeLevel = listing.grade_level || "Sin curso"
  const condition = conditionLabel(listing.condition)
  const type = listing.type || listing.listing_type || "sale"
  const price = listing.price
  const originalPrice = listing.original_price || listing.estimated_retail_price
  const postalCode = listing.postal_code

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
      <div className="mb-6">
        <Link href="/marketplace">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al marketplace
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex aspect-[4/3] items-center justify-center bg-muted">
            <span className="select-none font-mono text-7xl text-muted-foreground/15">
              {category.charAt(0)}
            </span>
          </div>
        </Card>

        <div className="space-y-6">
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
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <BookOpen className="h-4 w-4" />
                Descripción
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-4 w-4" />
                  Precio
                </div>

                {type === "donation" ? (
                  <p className="text-2xl font-bold text-primary">Gratis</p>
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
              </div>

              <Button size="lg">
                {type === "donation" ? "Solicitar donación" : "Contactar"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}