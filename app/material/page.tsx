import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Guías de material educativo reutilizado | Wetudy",
  description:
    "Guías para comprar, vender y donar libros, uniformes, calculadoras y material escolar reutilizado.",
};

export default async function MaterialIndexPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);
  const admin = createAdminClient();

  const { data: pages } = await admin
    .from("seo_programmatic_pages")
    .select("slug, heading, description, category, grade_level")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 lg:px-8">
        <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm lg:p-8">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Guías de material educativo
          </h1>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            Son guías públicas pensadas para familias, estudiantes y negocios. Explican qué buscar, cómo publicar mejor y enlazan con anuncios relevantes sin exponer datos sensibles de demanda.
          </p>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">¿En qué consisten?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Páginas SEO útiles por categoría, curso o necesidad, conectadas con el marketplace.</p>
          </div>
          <div className="rounded-3xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">¿Quién tiene acceso?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Son públicas. Ayudan a captar demanda y a explicar mejor qué puede encontrarse en Wetudy.</p>
          </div>
          <div className="rounded-3xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">¿A quién van dirigidas?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Familias, estudiantes y negocios que buscan o publican material educativo.</p>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {(pages || []).map((page: any) => (
            <article key={page.slug} className="rounded-3xl border bg-card p-5 shadow-sm">
              <h2 className="text-lg font-semibold">{page.heading}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/material/${page.slug}`}>Ver guía</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/marketplace?category=${encodeURIComponent(page.category || "")}&grade=${encodeURIComponent(page.grade_level || "")}`}>
                    Ver anuncios
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>

        {(pages || []).length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card p-8 text-center">
            <h2 className="text-xl font-semibold">Próximamente</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Estamos preparando guías útiles para material educativo reutilizado.
            </p>
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
