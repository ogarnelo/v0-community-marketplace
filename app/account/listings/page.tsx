import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Package } from "lucide-react"

export default async function MyListingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  const { data: listings } = await supabase
    .from("listings")
    .select("*")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis anuncios</h1>
          <p className="text-muted-foreground">
            Gestiona los artículos que has publicado en Wetudy.
          </p>
        </div>

        <Link href="/marketplace/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Publicar anuncio
          </Button>
        </Link>
      </div>

      {!listings || listings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">Aún no has publicado nada</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Publica tu primer artículo para empezar a reutilizar material escolar.
            </p>

            <Link href="/marketplace/new" className="mt-6">
              <Button>Crear primer anuncio</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing: any) => (
            <Link key={listing.id} href={`/marketplace/listing/${listing.id}`}>
              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-base line-clamp-2">
                    {listing.title}
                  </CardTitle>
                  <CardDescription>
                    {listing.category || "Sin categoría"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex items-center justify-between">
                  <Badge variant="outline">
                    {listing.status}
                  </Badge>

                  {listing.price ? (
                    <span className="font-semibold">
                      {listing.price}€
                    </span>
                  ) : (
                    <Badge>Donación</Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}