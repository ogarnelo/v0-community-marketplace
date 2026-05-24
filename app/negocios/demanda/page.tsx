import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { getDemandActivationOpportunities } from "@/lib/demand/opportunities";
import OpportunitiesList from "@/components/demand/opportunities-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Store } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Productos demandados | Wetudy para negocios",
  description:
    "Descubre qué productos educativos buscan familias y estudiantes en Wetudy para vender con más intención.",
};

export default async function PublicBusinessDemandPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);
  const opportunities = await getDemandActivationOpportunities(12);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">
        <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            Inteligencia de demanda educativa
          </Badge>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Vende productos que las familias ya están buscando
              </h1>
              <p className="mt-3 max-w-3xl text-muted-foreground">
                Wetudy detecta búsquedas sin resultado, búsquedas guardadas y peticiones de productos.
                Para un negocio local, esto puede convertirse en una guía clara de qué publicar primero.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/auth?mode=signup">Crear perfil profesional</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact">Hablar con Wetudy</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border bg-card p-5">
            <BarChart3 className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-semibold">Demanda real</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Señales agregadas de usuarios que buscan material educativo.
            </p>
          </div>
          <div className="rounded-3xl border bg-card p-5">
            <Store className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-semibold">Oferta más inteligente</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Publica productos con más probabilidad de recibir visitas, chats y ofertas.
            </p>
          </div>
          <div className="rounded-3xl border bg-card p-5">
            <BarChart3 className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-semibold">Packs y campañas</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Detecta cursos, categorías y zonas donde conviene preparar inventario.
            </p>
          </div>
        </section>

        <OpportunitiesList
          opportunities={opportunities}
          roleContext="public_business"
          emptyTitle="Aún estamos recogiendo señales"
          emptyText="Cuando haya suficientes búsquedas y demandas, mostraremos oportunidades agregadas para negocios."
        />

        <section className="mt-8 rounded-3xl border bg-primary p-6 text-primary-foreground">
          <h2 className="text-2xl font-bold">Para ver más oportunidades, crea tu perfil profesional</h2>
          <p className="mt-2 max-w-2xl text-primary-foreground/85">
            El panel profesional te ayudará a decidir qué productos subir primero y cómo convertir demanda en ventas.
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
