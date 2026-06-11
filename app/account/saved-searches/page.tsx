import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteSavedSearchButton from "@/components/account/delete-saved-search-button";

function buildSearchHref(search: any) {
  const params = new URLSearchParams();
  if (search.query) params.set("q", search.query);
  if (search.isbn) params.set("isbn", search.isbn);
  if (search.category) params.set("category", search.category);
  if (search.grade_level) params.set("grade", search.grade_level);
  if (search.condition) params.set("condition", search.condition);
  if (search.listing_type) params.set("type", search.listing_type);
  return params.toString() ? `/marketplace?${params.toString()}` : "/marketplace";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", year: "numeric" });
}

export default async function SavedSearchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: searches } = await supabase.from("saved_searches").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Búsquedas guardadas</h1>
          <p className="text-muted-foreground">Guarda búsquedas importantes y Wetudy te avisará cuando aparezcan anuncios compatibles.</p>
        </div>
        <Link href="/marketplace" className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Explorar marketplace</Link>
      </div>

      <div className="space-y-4">
        {(searches || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold">Todavía no tienes búsquedas guardadas</h2>
            <p className="mt-2 text-sm text-muted-foreground">Guarda búsquedas como “libros 2º ESO”, “uniforme” o un ISBN concreto para recibir alertas.</p>
            <Link href="/marketplace" className="mt-4 inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium">Crear una búsqueda</Link>
          </div>
        ) : searches!.map((search: any) => (
          <div key={search.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{search.name}</h2>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {search.query ? <span className="rounded-full bg-muted px-2 py-1">Texto: {search.query}</span> : null}
                  {search.isbn ? <span className="rounded-full bg-muted px-2 py-1">ISBN: {search.isbn}</span> : null}
                  {search.category ? <span className="rounded-full bg-muted px-2 py-1">Categoría: {search.category}</span> : null}
                  {search.grade_level ? <span className="rounded-full bg-muted px-2 py-1">Curso: {search.grade_level}</span> : null}
                  {search.listing_type ? <span className="rounded-full bg-muted px-2 py-1">Tipo: {search.listing_type}</span> : null}
                  {search.condition ? <span className="rounded-full bg-muted px-2 py-1">Estado: {search.condition}</span> : null}
                </div>
                <p className="text-xs text-muted-foreground">Creada el {formatDate(search.created_at)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={buildSearchHref(search)} className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium">Ver resultados</Link>
                <DeleteSavedSearchButton id={search.id} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
