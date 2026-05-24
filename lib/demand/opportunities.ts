import { createAdminClient } from "@/lib/supabase/admin";

export type DemandActivationOpportunity = {
  demand_key: string;
  normalized_query: string | null;
  category: string | null;
  grade_level: string | null;
  region: string | null;
  postal_prefix: string | null;
  searches: number;
  zero_results: number;
  saved_searches: number;
  explicit_requests: number;
  favorites: number;
  chats: number;
  offers: number;
  opportunity_score: number;
  last_seen_at: string | null;
  publish_clicks?: number;
  business_contact_clicks?: number;
  dismissed_count?: number;
  saved_for_later_count?: number;
  last_action_at?: string | null;
  priority?: "urgent" | "high" | "medium" | "emerging";
  recommendation_reason?: string | null;
};

function cleanLabel(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/^\(|\)$/g, "").trim();
}

export function opportunityLabel(opportunity: Partial<DemandActivationOpportunity>) {
  const query = cleanLabel(opportunity.normalized_query);
  const category = cleanLabel(opportunity.category);
  const grade = cleanLabel(opportunity.grade_level);

  const main =
    query && query !== "sin búsqueda"
      ? query
      : category && category !== "sin categoría"
        ? category
        : "Producto demandado";

  return grade && grade !== "sin curso" ? `${main} · ${grade}` : main;
}

export function opportunityKey(opportunity: Partial<DemandActivationOpportunity>) {
  return (
    cleanLabel(opportunity.demand_key) ||
    cleanLabel(opportunity.normalized_query) ||
    cleanLabel(opportunity.category) ||
    "demanda"
  );
}

export function opportunityPublishUrl(opportunity: Partial<DemandActivationOpportunity>) {
  const params = new URLSearchParams();

  const title = opportunityLabel(opportunity);
  if (title && title !== "Producto demandado") params.set("title", title);

  const category = cleanLabel(opportunity.category);
  const grade = cleanLabel(opportunity.grade_level);

  if (category && category !== "sin categoría") params.set("category", category);
  if (grade && grade !== "sin curso") params.set("grade_level", grade);

  params.set("source", "demand_opportunity");

  return `/marketplace/new?${params.toString()}`;
}

export function priorityLabel(priority?: string | null) {
  switch (priority) {
    case "urgent":
      return "Urgente";
    case "high":
      return "Alta";
    case "medium":
      return "Media";
    default:
      return "Emergente";
  }
}

export function priorityClassName(priority?: string | null) {
  switch (priority) {
    case "urgent":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "high":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "medium":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
}

export async function getDemandActivationOpportunities(limit = 20) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("demand_activation_opportunities_30d")
    .select("*")
    .order("opportunity_score", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("get_demand_activation_opportunities_error", error);
    return [] as DemandActivationOpportunity[];
  }

  return (data || []) as DemandActivationOpportunity[];
}
