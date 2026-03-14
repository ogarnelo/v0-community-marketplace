import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Package } from "lucide-react";
import { ListingStatusActions } from "@/components/account/listing-status-actions";

function getStatusLabel(status?: string | null) {
  switch (status) {
    case "available":
      return "Disponible";
    case "reserved":
      return "Reservado";
    case "sold":
      return "Vendido";
    case "archived":
      return "Archivado";
    default:
      return status || "Sin estado";
  }
}

function getStatusBadgeClass(status?: string | null) {
  switch (status) {
    case "available":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "reserved":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "sold":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "archived":
      return "border-slate-200 bg-slate-50 text-slate-500";
    default:
      return "";
  }
}

export default async function MyListingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: listings } = await supabase
    .from("listings")
    .select("*")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            <p className="mt-1 text-sm text-muted-foreground">
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
            <Card key={listing.id} className="transition hover:shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="line-clamp-2 text-base">
                      <Link href={`/marketplace/listing/${listing.id}`}>
                        {listing.title}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {listing.category || "Sin categoría"}
                    </CardDescription>
                  </div>

                  <Badge
                    variant="outline"
                    className={getStatusBadgeClass(listing.status)}
                  >
                    {getStatusLabel(listing.status)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex items-center justify-between">
                  {listing.price ? (
                    <span className="font-semibold">{listing.price}€</span>
                  ) : (
                    <Badge>Donación</Badge>
                  )}

                  <Link href={`/marketplace/listing/${listing.id}`}>
                    <Button variant="ghost" size="sm">
                      Ver anuncio
                    </Button>
                  </Link>
                </div>

                <ListingStatusActions
                  listingId={listing.id}
                  currentStatus={listing.status}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
