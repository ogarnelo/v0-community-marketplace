import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRankedListings } from "@/lib/marketplace/get-ranked-listings";
import DemandSearchTracker from "@/components/analytics/demand-search-tracker";
import CreateDemandRequestCard from "@/components/marketplace/create-demand-request-card";
import { ListingCard } from "@/components/listing-card";
import SaveSearchButton from "@/components/marketplace/save-search-button";
import PriceRangeFields from "@/components/marketplace/price-range-fields";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, Plus, ChevronDown, HelpCircle, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

const categories = [
  "Libros de texto",
  "Material escolar",
  "Mochilas y estuches",
  "Uniformes",
  "Tecnología",
  "Instrumentos musicales",
  "Material deportivo",
  "Otros",
];

const grades = [
  "Infantil",
  "1º Primaria",
  "2º Primaria",
  "3º Primaria",
  "4º Primaria",
  "5º Primaria",
  "6º Primaria",
  "1º ESO",
  "2º ESO",
  "3º ESO",
  "4º ESO",
  "1º Bachillerato",
  "2º Bachillerato",
  "Universidad",
  "Otros",
];
const conditions = [
  ["new", "Nuevo"],
  ["like_new", "Como nuevo"],
  ["good", "Bueno"],
  ["fair", "Aceptable"],
  ["poor", "Muy usado"],
];

type MarketplaceParams = Record<string, string | string[] | undefined>;

function getParam(params: MarketplaceParams, key: string) {
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
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <select
        name={name}
        defaultValue={value || ""}
        className="h-11 w-full rounded-xl border bg-background px-3 text-sm shadow-sm"
      >
        {children}
      </select>
    </label>
  );
}

function MarketplaceFiltersForm({
  q,
  category,
  grade,
  condition,
  type,
  isbn,
  sort,
  minPrice,
  maxPrice,
  scope,
  hasFilters,
  isLoggedIn,
}: {
  q: string;
  category: string;
  grade: string;
  condition: string;
  type: string;
  isbn: string;
  sort: string;
  minPrice: string;
  maxPrice: string;
  scope: string;
  hasFilters: boolean;
  isLoggedIn: boolean;
}) {
  return (
    <form action="/marketplace" className="space-y-4">
      <label className="space-y-1.5 text-sm">
        <span className="font-medium text-foreground">Buscar</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Título, asignatura o ISBN"
            className="h-11 w-full rounded-xl border bg-background pl-9 pr-3 text-sm shadow-sm"
          />
        </div>
      </label>


      <SelectField name="scope" label="Comunidad" value={scope}>
        <option value="">Todos los productos</option>
        <option value="school">Solo mi colegio</option>
      </SelectField>

      <div className="rounded-2xl border bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <MapPin className="h-4 w-4" />
          Proximidad
        </div>
        <p className="mt-1">
          El filtro por colegio ya está disponible. El radio por kilómetros requiere activar ubicación/código postal por anuncio y será el siguiente paso.
        </p>
      </div>

      <SelectField name="category" label="Categoría" value={category}>
        <option value="">Todas</option>
        {categories.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </SelectField>

      <SelectField name="grade" label="Curso" value={grade}>
        <option value="">Todos</option>
        {grades.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </SelectField>

      <SelectField name="condition" label="Estado" value={condition}>
        <option value="">Todos</option>
        {conditions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>

      <SelectField name="type" label="Tipo" value={type}>
        <option value="">Venta y donación</option>
        <option value="sale">Solo venta</option>
        <option value="donation">Solo donación</option>
      </SelectField>

      <label className="space-y-1.5 text-sm">
        <span className="flex items-center gap-1 font-medium text-foreground">
          ISBN
          <span className="group relative inline-flex">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-72 -translate-x-1/2 rounded-xl border bg-popover p-3 text-xs font-normal text-popover-foreground shadow-lg group-hover:block group-focus-within:block">
              ¿Qué es el ISBN? ISBN son las siglas de International Standard Book Number y consiste en un código que nos sirve para identificar de manera única cada producto editorial.
            </span>
          </span>
        </span>
        <input
          name="isbn"
          defaultValue={isbn}
          placeholder="ISBN"
          className="h-11 w-full rounded-xl border bg-background px-3 text-sm shadow-sm"
        />
      </label>


      <PriceRangeFields minPrice={minPrice} maxPrice={maxPrice} />

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

      <div className="pt-1">
        {isLoggedIn ? (
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
    </form>
  );
}

function ActiveFilterChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<MarketplaceParams>;
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
  const minPrice = getParam(params, "minPrice") || "";
  const maxPrice = getParam(params, "maxPrice") || "";
  const scope = getParam(params, "scope") || "";

  const { data: profile } = user
    ? await supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle()
    : { data: null as any };

  const currentSchoolId = (profile as any)?.school_id || null;

  const listings = await getRankedListings({
    q,
    category,
    grade,
    condition,
    type,
    isbn,
    sort,
    minPrice,
    maxPrice,
    scope,
    currentSchoolId,
    currentUserId: user?.id || null,
    limit: 80,
  });

  const hasFilters = Boolean(q || category || grade || condition || type || isbn || minPrice || maxPrice || scope);
  const filterForm = (
    <MarketplaceFiltersForm
      q={q}
      category={category}
      grade={grade}
      condition={condition}
      type={type}
      isbn={isbn}
      sort={sort}
      minPrice={minPrice}
      maxPrice={maxPrice}
      scope={scope}
      hasFilters={hasFilters}
      isLoggedIn={!!user}
    />
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 pb-24 sm:px-4 sm:py-6 lg:px-8 md:pb-6">
      <DemandSearchTracker
        query={q}
        category={category}
        gradeLevel={grade}
        condition={condition}
        listingType={type}
        isbn={isbn}
        resultCount={listings.length}
      />
      <section className="mb-5 overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Comunidad educativa
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Encuentra todo lo que necesitas para este curso escolar
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Compra, vende, dona y reutiliza dentro de tu comunidad. Usa los filtros, pulsa “Guardar búsqueda” y Wetudy te avisará cuando aparezcan productos compatibles.
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

      <div className="mb-4 lg:hidden">
        <details className="group rounded-2xl border bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros y búsqueda
            </span>
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
          </summary>
          <div className="border-t p-4">{filterForm}</div>
        </details>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-3xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              <h2 className="font-semibold">Filtros</h2>
            </div>
            {filterForm}
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-4 rounded-2xl border bg-card p-3 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="text-sm font-medium">
                {listings.length} anuncio{listings.length === 1 ? "" : "s"} disponible{listings.length === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ordenado por {sort === "relevance" ? "relevancia" : sort.replace("-", " ")}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
              {category ? <ActiveFilterChip>{category}</ActiveFilterChip> : null}
              {grade ? <ActiveFilterChip>{grade}</ActiveFilterChip> : null}
              {type ? <ActiveFilterChip>{type === "donation" ? "Donación" : "Venta"}</ActiveFilterChip> : null}
              {scope === "school" ? <ActiveFilterChip>Mi colegio</ActiveFilterChip> : null}
              {minPrice ? <ActiveFilterChip>Desde {minPrice} €</ActiveFilterChip> : null}
              {maxPrice ? <ActiveFilterChip>Hasta {maxPrice} €</ActiveFilterChip> : null}
              {q ? <ActiveFilterChip>“{q}”</ActiveFilterChip> : null}
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

              <CreateDemandRequestCard
                isLoggedIn={!!user}
                query={q}
                category={category}
                gradeLevel={grade}
                isbn={isbn}
                resultCount={listings.length}
              />
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
