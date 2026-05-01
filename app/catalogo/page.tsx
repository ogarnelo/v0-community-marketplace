import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CourseMaterialForm from "@/components/catalog/course-material-form";
import CourseMaterialsBrowser from "@/components/catalog/course-materials-browser";

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  let query = supabase
    .from("course_materials")
    .select("id, title, grade_level, subject, isbn, category, source, confidence_score, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (params.grade) {
    query = query.eq("grade_level", params.grade);
  }

  if (params.q) {
    query = query.ilike("title", `%${params.q}%`);
  }

  const { data: materials } = await query;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Catálogo guiado
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Catálogo educativo de la comunidad
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Añade libros, uniformes y materiales por curso para que Wetudy pueda recomendar anuncios compatibles y construir un catálogo educativo propio sin depender de colegios desde el primer día.
        </p>
      </div>

      <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Añadir material</h2>
        <CourseMaterialForm />
      </div>

      <CourseMaterialsBrowser materials={materials || []} />
    </div>
  );
}
