import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRankedListings } from "@/lib/marketplace/get-ranked-listings";
import { ListingCard } from "@/components/listing-card";
import SaveSearchButton from "@/components/marketplace/save-search-button";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const categories = ["Libros", "Uniformes", "Material escolar", "Calculadoras", "Tecnología", "Apuntes", "Otros"];
const grades = ["Infantil", "Primaria", "1 ESO", "2 ESO", "3 ESO", "4 ESO", "1 Bachillerato", "2 Bachillerato", "Universidad", "Academia"];
const conditions = [
  ["new", "Nuevo"],
  ["like_new", "Como nuevo"],
  ["good", "Bueno"],
  ["fair", "Aceptable"],
  ["poor", "Muy usado"],
];

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function SelectField({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <select name={name} defaultValue={value || ""} className="h-11 w-full rounded-xl border bg-background px-3 text-sm">
        {children}
      </select>
    </label>
  );
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const q = getParam(params, "q") || "";
  const category = getParam(params, "category") || "";
  const grade = getParam(params, "grade") || "";
  const condition = getParam(params, "condition") || "";
  const type = getParam(params, "type") || "";
  const isbn = getParam(params, "isbn") || "";
  const sort = getParam(params, "sort") || "relevance";

  const listings = await getRankedListings({
    q,
    category,
    grade,
    condition,
    type,
    isbn,
    sort,
    currentUserId: user?.id || null,
    limit: 120,
  });

  const hasFilters = Boolean(q || category || grade || condition || type || isbn);

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 pb-24 sm:px-4 sm:py-6 lg:px-8 md:pb-6">
      <section className="mb-5 overflow-hidden rounded-3xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Marketplace educativo
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Encuentra libros, uniformes y material educativo
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Compra, vende, dona y reutiliza dentro de tu comunidad. Guarda búsquedas para recibir alertas cuando aparezcan productos compatibles.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={user ? "/marketplace/new" : "/auth?next=/marketplace/new"}>
                <Plus className="mr-2 h-4 w-4" />
                Publicar
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/catalogo">Catálogo guiado</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <form action="/marketplace" className="rounded-3xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              <h2 className="font-semibold">Filtros</h2>
            </div>

            <div className="space-y-4">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-foreground">Buscar</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    name="q"
                    defaultValue={q}
                    placeholder="Título, asignatura o ISBN"
                    className="h-11 w-full rounded-xl border bg-background pl-9 pr-3 text-sm"
                  />
                </div>
              </label>

              <SelectField name="category" label="Categoría" value={category}>
                <option value="">Todas</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectField>

              <SelectField name="grade" label="Curso" value={grade}>
                <option value="">Todos</option>
                {grades.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectField>

              <SelectField name="condition" label="Estado" value={condition}>
                <option value="">Todos</option>
                {conditions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </SelectField>

              <SelectField name="type" label="Tipo" value={type}>
                <option value="">Venta y donación</option>
                <option value="sale">Solo venta</option>
                <option value="donation">Solo donación</option>
              </SelectField>

              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-foreground">ISBN</span>
                <input
                  name="isbn"
                  defaultValue={isbn}
                  placeholder="ISBN"
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                />
              </label>

              <SelectField name="sort" label="Ordenar por" value={sort}>
                <option value="relevance">Relevancia</option>
                <option value="price-asc">Precio ascendente</option>
                <option value="price-desc">Precio descendente</option>
                <option value="savings">Mayor ahorro</option>
                <option value="title">Título A-Z</option>
              </SelectField>

              <Button type="submit" className="w-full">
                Aplicar filtros
              </Button>

              {hasFilters ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href="/marketplace">Limpiar filtros</Link>
                </Button>
              ) : null}

              <div className="pt-2">
                {user ? (
                  <SaveSearchButton
                    query={q}
                    category={category}
                    gradeLevel={grade}
                    condition={condition}
                    listingType={type}
                    isbn={isbn}
                    label="Guardar búsqueda"
                  />
                ) : (
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/auth?next=/marketplace">Guardar búsqueda</Link>
                  </Button>
                )}
              </div>
            </div>
          </form>
        </aside>

        <main className="min-w-0">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {listings.length} anuncio{listings.length === 1 ? "" : "s"} disponible{listings.length === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {category ? <span className="rounded-full bg-muted px-2 py-1">{category}</span> : null}
              {grade ? <span className="rounded-full bg-muted px-2 py-1">{grade}</span> : null}
              {type ? <span className="rounded-full bg-muted px-2 py-1">{type === "donation" ? "Donación" : "Venta"}</span> : null}
            </div>
          </div>

          {listings.length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-card p-8 text-center shadow-sm">
              <h2 className="text-xl font-semibold">No hay anuncios con estos filtros</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Guarda esta búsqueda o prueba con otro curso/categoría para encontrar resultados.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/marketplace">Ver todos</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/marketplace/new">Publicar anuncio</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
