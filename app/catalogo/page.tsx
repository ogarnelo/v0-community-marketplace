import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import CourseMaterialForm from "@/components/catalog/course-material-form";
import CourseMaterialsBrowser from "@/components/catalog/course-materials-browser";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Catálogo educativo | Wetudy",
  description: "Catálogo educativo guiado por curso, asignatura e ISBN para encontrar material compatible.",
};

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  let query = supabase
    .from("course_materials")
    .select("id, title, grade_level, subject, isbn, category, source, confidence_score, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (params.grade) query = query.eq("grade_level", params.grade);
  if (params.q) query = query.ilike("title", `%${params.q}%`);

  const { data: materials } = await query;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">
        <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Catálogo guiado
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            Catálogo educativo de la comunidad
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Wetudy aprende qué materiales se usan por curso, asignatura e ISBN para ayudarte a encontrar anuncios compatibles sin depender de un catálogo oficial desde el primer día.
          </p>
          {!navbarData.isLoggedIn ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild><Link href="/auth?next=/catalogo">Inicia sesión para contribuir</Link></Button>
              <Button asChild variant="outline"><Link href="/marketplace">Explorar marketplace</Link></Button>
            </div>
          ) : null}
        </div>

        {navbarData.isLoggedIn ? (
          <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Añadir material</h2>
            <CourseMaterialForm />
          </div>
        ) : null}

        <CourseMaterialsBrowser materials={materials || []} />
      </main>
      <Footer />
    </div>
  );
}
