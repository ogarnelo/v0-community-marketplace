import { createAdminClient } from "@/lib/supabase/admin";

export const SAFE_SEO_CATEGORIES = [
  "Libros de texto",
  "Libros",
  "Uniformes",
  "Material escolar",
  "Calculadoras",
  "Tecnología educativa",
  "Mochilas y estuches",
  "Apuntes",
] as const;

export const EVERGREEN_SEO_PAGES = [
  {
    slug: "libros-texto-segunda-mano",
    pageKind: "evergreen_category",
    category: "Libros de texto",
    gradeLevel: null,
    query: null,
    title: "Libros de texto de segunda mano | Wetudy",
    heading: "Libros de texto de segunda mano",
    description: "Compra, vende y dona libros de texto reutilizados para ahorrar en la vuelta al curso.",
  },
  {
    slug: "uniformes-escolares-segunda-mano",
    pageKind: "evergreen_category",
    category: "Uniformes",
    gradeLevel: null,
    query: null,
    title: "Uniformes escolares de segunda mano | Wetudy",
    heading: "Uniformes escolares de segunda mano",
    description: "Encuentra uniformes escolares reutilizados y da más vida a prendas que todavía pueden servir.",
  },
  {
    slug: "calculadoras-cientificas-segunda-mano",
    pageKind: "evergreen_category",
    category: "Calculadoras",
    gradeLevel: null,
    query: "calculadora cientifica",
    title: "Calculadoras científicas de segunda mano | Wetudy",
    heading: "Calculadoras científicas de segunda mano",
    description: "Compra y vende calculadoras científicas reutilizadas para ESO, Bachillerato y universidad.",
  },
  {
    slug: "material-escolar-segunda-mano",
    pageKind: "evergreen_category",
    category: "Material escolar",
    gradeLevel: null,
    query: null,
    title: "Material escolar de segunda mano | Wetudy",
    heading: "Material escolar de segunda mano",
    description: "Compra, vende y dona material escolar reutilizado entre familias, estudiantes y negocios locales.",
  },
];

export type SeoProgrammaticPage = {
  id: string;
  slug: string;
  status: "draft" | "published" | "noindex" | "archived";
  page_kind: "evergreen_category" | "category_grade" | "query_category";
  title: string;
  heading: string;
  description: string;
  category: string | null;
  grade_level: string | null;
  query: string | null;
  region: string | null;
  postal_prefix: string | null;
  min_listing_count: number;
  active_listing_count: number;
  source_opportunity_score: number;
  source_zero_results: number;
  source_saved_searches: number;
  source_explicit_requests: number;
  last_demand_seen_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export function slugifySeo(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalize(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function isSafeSeoCategory(category: unknown) {
  const value = normalize(category);
  return SAFE_SEO_CATEGORIES.some((item) => item.toLowerCase() === value.toLowerCase());
}

function canonicalCategory(category: string) {
  const found = SAFE_SEO_CATEGORIES.find((item) => item.toLowerCase() === category.toLowerCase());
  return found || category;
}

export function buildCategoryGradeSeoPage(input: {
  category: string;
  gradeLevel?: string | null;
  score?: number;
  zeroResults?: number;
  savedSearches?: number;
  explicitRequests?: number;
  activeListingCount?: number;
  lastDemandSeenAt?: string | null;
}) {
  const category = canonicalCategory(input.category);
  const gradeLevel = normalize(input.gradeLevel);
  const base = gradeLevel ? `${category} ${gradeLevel} segunda mano` : `${category} segunda mano`;
  const slug = slugifySeo(base);

  const heading = gradeLevel ? `${category} de segunda mano para ${gradeLevel}` : `${category} de segunda mano`;
  const title = `${heading} | Wetudy`;
  const description = gradeLevel
    ? `Encuentra y publica ${category.toLowerCase()} para ${gradeLevel}. Ahorra reutilizando material educativo en Wetudy.`
    : `Encuentra y publica ${category.toLowerCase()}. Ahorra reutilizando material educativo en Wetudy.`;

  return {
    slug,
    pageKind: gradeLevel ? "category_grade" : "evergreen_category",
    title,
    heading,
    description,
    category,
    gradeLevel: gradeLevel || null,
    query: null,
    score: input.score || 0,
    zeroResults: input.zeroResults || 0,
    savedSearches: input.savedSearches || 0,
    explicitRequests: input.explicitRequests || 0,
    activeListingCount: input.activeListingCount || 0,
    lastDemandSeenAt: input.lastDemandSeenAt || null,
  };
}

export function listingSearchParams(page: Partial<SeoProgrammaticPage>) {
  const params = new URLSearchParams();

  if (page.category) params.set("category", page.category);
  if (page.grade_level) params.set("grade", page.grade_level);
  if (page.query) params.set("q", page.query);

  return params.toString();
}

export async function countActiveListingsForSeo(input: {
  category?: string | null;
  gradeLevel?: string | null;
  query?: string | null;
}) {
  const admin = createAdminClient();

  let query = admin
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "available");

  if (input.category) query = query.eq("category", input.category);
  if (input.gradeLevel) query = query.eq("grade_level", input.gradeLevel);
  if (input.query) query = query.ilike("title", `%${input.query}%`);

  const { count, error } = await query;

  if (error) {
    console.error("seo_count_active_listings_error", error);
    return 0;
  }

  return count || 0;
}

export async function upsertSeoProgrammaticPage(input: {
  slug: string;
  pageKind: string;
  title: string;
  heading: string;
  description: string;
  category?: string | null;
  gradeLevel?: string | null;
  query?: string | null;
  status: "draft" | "published" | "noindex" | "archived";
  minListingCount?: number;
  activeListingCount?: number;
  sourceOpportunityScore?: number;
  sourceZeroResults?: number;
  sourceSavedSearches?: number;
  sourceExplicitRequests?: number;
  lastDemandSeenAt?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();

  const payload = {
    slug: input.slug,
    status: input.status,
    page_kind: input.pageKind,
    title: input.title,
    heading: input.heading,
    description: input.description,
    category: input.category || null,
    grade_level: input.gradeLevel || null,
    query: input.query || null,
    region: null,
    postal_prefix: null,
    min_listing_count: input.minListingCount || 0,
    active_listing_count: input.activeListingCount || 0,
    source_opportunity_score: input.sourceOpportunityScore || 0,
    source_zero_results: input.sourceZeroResults || 0,
    source_saved_searches: input.sourceSavedSearches || 0,
    source_explicit_requests: input.sourceExplicitRequests || 0,
    last_demand_seen_at: input.lastDemandSeenAt || null,
    published_at: input.status === "published" ? new Date().toISOString() : null,
    metadata: input.metadata || {},
  };

  const { data, error } = await admin
    .from("seo_programmatic_pages")
    .upsert(payload, { onConflict: "slug" })
    .select("*")
    .single();

  if (error) {
    console.error("upsert_seo_programmatic_page_error", error);
    return { ok: false, error, data: null };
  }

  return { ok: true, data: data as SeoProgrammaticPage, error: null };
}
