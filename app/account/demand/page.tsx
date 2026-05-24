import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { getBasicDemandThemes } from "@/lib/demand/opportunities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BellPlus, BookOpen, Search, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lo que se está buscando | Wetudy",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountDemandPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/demand");

  const themes = await getBasicDemandThemes(10);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 lg:px-8">
        <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            Señales básicas de la comunidad
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">Lo que otras familias están buscando</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Mostramos tendencias generales para ayudarte a publicar mejor y encontrar material más rápido.
            Los detalles completos se reservan para negocios verificados y el equipo de Wetudy.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/marketplace/new">Publicar material</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/marketplace">Buscar en marketplace</Link>
            </Button>
          </div>
        </section>

        {themes.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card p-8 text-center">
            <Search className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-4 text-xl font-semibold">Aún estamos recogiendo señales</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              Las tendencias aparecerán cuando haya búsquedas guardadas, demandas y actividad suficiente.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {themes.map((theme) => (
              <div key={theme.label} className="rounded-3xl border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <BookOpen className="h-7 w-7 text-primary" />
                    <h2 className="mt-3 font-semibold">{theme.label}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Hay señales de interés en esta categoría o curso.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {theme.strength}
                  </Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`/marketplace/new?category=${encodeURIComponent(theme.category || "")}&grade_level=${encodeURIComponent(theme.gradeLevel || "")}`}>
                      Publicar algo similar
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/marketplace?category=${encodeURIComponent(theme.category || "")}&grade=${encodeURIComponent(theme.gradeLevel || "")}`}>
                      Buscar
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <section className="mt-8 rounded-3xl border bg-muted/40 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <BellPlus className="h-7 w-7 text-primary" />
            <div>
              <h2 className="font-semibold">¿Buscas algo que no aparece?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Haz una búsqueda en marketplace. Si no hay resultados, podrás registrar esa demanda para que Wetudy detecte qué falta.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
