import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import ConversionNudgeActions from "@/components/conversion/conversion-nudge-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Asistente de ventas | Wetudy",
  robots: {
    index: false,
    follow: false,
  },
};

function nudgeLabel(type: string) {
  switch (type) {
    case "listing_has_demand":
      return "Demanda activa";
    case "publish_more_like_this":
      return "Publica más";
    case "price_adjustment":
      return "Optimiza precio";
    case "share_listing":
      return "Comparte";
    case "respond_to_offer":
      return "Oferta pendiente";
    default:
      return "Sugerencia";
  }
}

export default async function AccountGrowthPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/growth");

  const admin = createAdminClient();

  const { data: nudges } = await admin
    .from("conversion_nudges")
    .select("id, listing_id, nudge_type, status, message, href, action_label, metadata, created_at")
    .eq("user_id", user.id)
    .in("status", ["pending", "sent"])
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 lg:px-8">
        <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Asistente de ventas</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Recomendaciones automáticas para vender antes: demanda activa, productos similares, mejoras de anuncio y acciones rápidas.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/marketplace/new">Publicar anuncio</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/account/business/opportunities">Ver productos demandados</Link>
            </Button>
          </div>
        </section>

        <div className="grid gap-4">
          {(nudges || []).map((nudge: any) => (
            <article key={nudge.id} className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    <Badge variant="secondary">{nudgeLabel(nudge.nudge_type)}</Badge>
                  </div>
                  <p className="mt-3 font-medium">{nudge.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(nudge.created_at).toLocaleString("es-ES")}
                  </p>
                </div>

                <ConversionNudgeActions
                  id={nudge.id}
                  href={nudge.href}
                  actionLabel={nudge.action_label}
                />
              </div>
            </article>
          ))}

          {(nudges || []).length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-card p-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-primary" />
              <h2 className="mt-4 text-xl font-semibold">Aún no hay sugerencias</h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
                Cuando tus anuncios reciban demanda, favoritos o señales de conversión, aparecerán recomendaciones aquí.
              </p>
            </div>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}
