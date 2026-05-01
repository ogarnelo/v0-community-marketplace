import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BusinessShareProfileCard from "@/components/business/business-share-profile-card";

function StatCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function BusinessAccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, user_type, business_name, business_description, website, is_business_verified")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.user_type !== "business") {
    redirect("/account");
  }

  const [
    { count: activeListingsCount },
    { count: soldListingsCount },
    { count: followersCount },
    { data: latestListings },
    { data: boosts },
  ] = await Promise.all([
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "available"),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "sold"),
    supabase
      .from("user_follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", user.id),
    supabase
      .from("listings")
      .select("id, title, price, status, created_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("listing_boosts")
      .select("id, listing_id, created_at, featured_until, payment_status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const profileUrl = `${appUrl}/profile/${user.id}`;

  const activeBoosts = (boosts || []).filter((boost: any) => {
    if (!boost.featured_until) return true;
    return new Date(boost.featured_until).getTime() > Date.now();
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Panel profesional</Badge>
            {profile?.is_business_verified ? <Badge>Negocio verificado</Badge> : null}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {profile?.business_name || profile?.full_name || "Mi negocio"}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Gestiona tus anuncios, visibilidad y presencia profesional en Wetudy.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/marketplace/new"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Publicar producto
          </Link>
          <Link
            href="/account/listings"
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Mis anuncios
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard title="Anuncios activos" value={activeListingsCount || 0} helper="Productos disponibles ahora" />
        <StatCard title="Ventas cerradas" value={soldListingsCount || 0} helper="Histórico de anuncios vendidos" />
        <StatCard title="Seguidores" value={followersCount || 0} helper="Usuarios que reciben tus novedades" />
        <StatCard title="Impulsos activos" value={activeBoosts.length} helper="Anuncios con visibilidad extra" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Últimos anuncios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(latestListings || []).length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Todavía no has publicado productos. Empieza subiendo tus productos más demandados.
              </div>
            ) : (
              latestListings!.map((listing: any) => (
                <div key={listing.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <Link href={`/marketplace/listing/${listing.id}`} className="font-medium hover:underline">
                      {listing.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {listing.price ? `${listing.price} €` : "Sin precio"} · {listing.status}
                    </p>
                  </div>
                  <Link
                    href={`/marketplace/edit/${listing.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Editar
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <BusinessShareProfileCard profileUrl={profileUrl} />
          <Card>
            <CardHeader>
              <CardTitle>Consejos para vender más</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>• Usa fotos claras y precio competitivo.</p>
              <p>• Añade ISBN en libros para aparecer en búsquedas guardadas.</p>
              <p>• Pide a tus clientes que sigan tu perfil para recibir nuevos productos.</p>
              <p>• Impulsa productos clave cuando quieras recuperar visibilidad.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
