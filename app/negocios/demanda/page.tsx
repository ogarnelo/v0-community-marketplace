import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, LockKeyhole, PackagePlus, Store, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inteligencia de demanda educativa | Wetudy para negocios",
  description:
    "Wetudy ayuda a negocios locales a entender qué material educativo buscan las familias para publicar mejor.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicBusinessDemandPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">
        <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm lg:p-8">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            Para negocios locales
          </Badge>

          <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
                Publica productos con más intención de compra
              </h1>
              <p className="mt-4 max-w-3xl text-muted-foreground">
                Wetudy detecta señales agregadas de demanda educativa para ayudar a librerías,
                papelerías, academias y tiendas locales a decidir qué productos subir primero.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/auth?mode=signup">Crear perfil profesional</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/contact">Hablar con Wetudy</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border bg-muted/40 p-5">
              <LockKeyhole className="h-8 w-8 text-primary" />
              <h2 className="mt-4 text-xl font-semibold">La demanda real no es pública</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Las oportunidades concretas se muestran solo a usuarios registrados, negocios verificados
                y administradores. Así protegemos la ventaja competitiva de la comunidad.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border bg-card p-5">
            <BarChart3 className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-semibold">Usuarios registrados</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ven tendencias básicas: categorías y cursos donde otras familias muestran interés.
            </p>
          </div>

          <div className="rounded-3xl border bg-card p-5">
            <PackagePlus className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-semibold">Negocios</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ven oportunidades accionables y botones para publicar productos demandados.
            </p>
          </div>

          <div className="rounded-3xl border bg-card p-5">
            <TrendingUp className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-semibold">Wetudy</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Analiza demanda completa para captar oferta, lanzar campañas y mejorar el catálogo.
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border bg-primary p-6 text-primary-foreground">
          <Store className="h-8 w-8" />
          <h2 className="mt-4 text-2xl font-bold">Tu tienda ya tiene productos. Wetudy te ayuda a priorizarlos.</h2>
          <p className="mt-2 max-w-2xl text-primary-foreground/85">
            Empieza con un perfil profesional y usa señales de demanda para publicar con más velocidad.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href="/auth?mode=signup">Crear perfil profesional</Link>
            </Button>
            <Button asChild variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              <Link href="/negocios">Ver ventajas para negocios</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
