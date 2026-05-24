import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { listingSearchParams } from "@/lib/seo/programmatic";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

async function getPage(slug: string) {
  const admin = createAdminClient();

  const { data } = await admin
    .from("seo_programmatic_pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return data as any | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) return {};

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: `/material/${page.slug}`,
    },
  };
}

export default async function MaterialSeoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) notFound();

  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);
  const search = listingSearchParams(page);
  const marketplaceHref = search ? `/marketplace?${search}` : "/marketplace";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 lg:px-8">
        <section className="rounded-3xl border bg-card p-6 shadow-sm lg:p-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{page.heading}</h1>
          <p className="mt-4 max-w-3xl text-muted-foreground">{page.description}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={marketplaceHref}>Ver anuncios</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/marketplace/new">Publicar material</Link>
            </Button>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            "Busca por curso, categoría o ISBN cuando esté disponible.",
            "Pregunta por chat antes de cerrar una operación.",
            "Publica material que ya no usas para ayudar a otra familia.",
          ].map((bullet) => (
            <div key={bullet} className="rounded-3xl border bg-card p-5">
              <CheckCircle2 className="h-6 w-6 text-primary" />
              <p className="mt-3 text-sm font-medium">{bullet}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border bg-muted/40 p-6">
          <h2 className="text-xl font-semibold">Antes de comprarlo nuevo, mira si ya existe en Wetudy</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Wetudy ayuda a que el material educativo circule más y a que las familias reduzcan gasto sin perder confianza.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
