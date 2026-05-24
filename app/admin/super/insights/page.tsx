import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BellPlus,
  MapPin,
  Search,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

const FALLBACK_SUPERADMIN_EMAILS = ["oscar_garnelo@hotmail.com"];

type DemandEvent = {
  id: string;
  event_type: string;
  normalized_query: string | null;
  category: string | null;
  grade_level: string | null;
  result_count: number | null;
  postal_prefix: string | null;
  region: string | null;
  school_id: string | null;
  created_at: string;
};

type DemandRequest = {
  id: string;
  title: string;
  normalized_query: string | null;
  category: string | null;
  grade_level: string | null;
  isbn: string | null;
  postal_prefix: string | null;
  region: string | null;
  status: string;
  created_at: string;
};

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function topEntries(map: Map<string, number>, limit = 10) {
  return [...map.entries()]
    .filter(([key]) => key && key !== "(vacío)")
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function eventLabel(eventType: string) {
  switch (eventType) {
    case "zero_result_search":
      return "Búsquedas sin resultado";
    case "search_performed":
      return "Búsquedas con resultado";
    case "saved_search_created":
      return "Búsquedas guardadas";
    case "marketplace_browse":
      return "Exploración marketplace";
    case "listing_viewed":
      return "Vistas de anuncio";
    case "favorite_created":
      return "Favoritos";
    case "chat_started":
      return "Chats iniciados";
    case "offer_created":
      return "Ofertas";
    case "payment_completed":
      return "Pagos";
    default:
      return eventType;
  }
}

function configuredFallbackEmails() {
  const fromEnv = process.env.SUPERADMIN_EMAILS?.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean) || [];
  return new Set([...FALLBACK_SUPERADMIN_EMAILS, ...fromEnv].map((item) => item.toLowerCase()));
}

async function canAccessDemandInsights(userId: string, email: string | null | undefined) {
  const admin = createAdminClient();

  try {
    const { data } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (data?.role === "super_admin") return true;
  } catch {
    // fallback temporal por compatibilidad con el panel super existente
  }

  return Boolean(email && configuredFallbackEmails().has(email.toLowerCase()));
}

function demandKey(event: DemandEvent | DemandRequest) {
  return (
    event.normalized_query ||
    event.category ||
    event.isbn ||
    ("title" in event ? event.title : "") ||
    "demanda"
  );
}

export default async function DemandInsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const canAccess = await canAccessDemandInsights(user.id, user.email);
  if (!canAccess) redirect("/account");

  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data, error }, { data: requestRows, error: requestError }] = await Promise.all([
    admin
      .from("demand_events")
      .select("id, event_type, normalized_query, category, grade_level, result_count, postal_prefix, region, school_id, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2500),
    admin
      .from("demand_requests")
      .select("id, title, normalized_query, category, grade_level, isbn, postal_prefix, region, status, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const events = (data || []) as DemandEvent[];
  const requests = (requestRows || []) as DemandRequest[];

  const byEvent = new Map<string, number>();
  const zeroQueries = new Map<string, number>();
  const savedQueries = new Map<string, number>();
  const explicitRequests = new Map<string, number>();
  const categoryDemand = new Map<string, number>();
  const gradeDemand = new Map<string, number>();
  const regionDemand = new Map<string, number>();
  const opportunity = new Map<string, number>();

  for (const event of events) {
    increment(byEvent, event.event_type);

    const key = demandKey(event);
    const category = event.category || "";
    const grade = event.grade_level || "";
    const region = event.region || event.postal_prefix || "";

    if (event.event_type === "zero_result_search") {
      increment(zeroQueries, key);
      increment(opportunity, `${key} · ${grade || "sin curso"}`, 4);
    }

    if (event.event_type === "saved_search_created") {
      increment(savedQueries, key);
      increment(opportunity, `${key} · ${grade || "sin curso"}`, 3);
    }

    if (event.event_type === "favorite_created") increment(opportunity, `${key} · ${grade || "sin curso"}`, 2);
    if (event.event_type === "chat_started") increment(opportunity, `${key} · ${grade || "sin curso"}`, 3);
    if (event.event_type === "offer_created") increment(opportunity, `${key} · ${grade || "sin curso"}`, 5);

    if (["search_performed", "zero_result_search", "saved_search_created"].includes(event.event_type)) {
      if (category) increment(categoryDemand, category);
      if (grade) increment(gradeDemand, grade);
      if (region) increment(regionDemand, region);
      if ((event.result_count || 0) <= 2) increment(opportunity, `${key} · ${grade || "sin curso"}`, 1);
    }
  }

  for (const request of requests.filter((item) => item.status === "open")) {
    const key = demandKey(request);
    const grade = request.grade_level || "";
    const region = request.region || request.postal_prefix || "";

    increment(explicitRequests, `${key} · ${grade || "sin curso"}`);
    increment(opportunity, `${key} · ${grade || "sin curso"}`, 6);
    if (request.category) increment(categoryDemand, request.category, 2);
    if (request.grade_level) increment(gradeDemand, request.grade_level, 2);
    if (region) increment(regionDemand, region, 2);
  }

  const totalSearchDemand =
    (byEvent.get("search_performed") || 0) +
    (byEvent.get("zero_result_search") || 0) +
    (byEvent.get("saved_search_created") || 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-3 gap-2 px-0">
            <Link href="/admin/super">
              <ArrowLeft className="h-4 w-4" />
              Volver al panel
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Demand Intelligence v2</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Señales de demanda de los últimos 30 días: búsquedas, cero resultados,
            búsquedas guardadas, demandas explícitas, categorías, cursos y regiones.
          </p>
        </div>
      </div>

      {error || requestError ? (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="flex gap-3 p-5 text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>
              No se pudieron cargar todos los datos de demanda. Asegúrate de aplicar las migraciones
              <code className="mx-1">demand_intelligence</code> y <code>demand_intelligence_v2</code>.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric title="Eventos 30 días" value={events.length} />
        <Metric title="Demanda de búsqueda" value={totalSearchDemand} />
        <Metric title="Sin resultado" value={byEvent.get("zero_result_search") || 0} />
        <Metric title="Guardadas" value={byEvent.get("saved_search_created") || 0} />
        <Metric title="Demandas explícitas" value={requests.filter((item) => item.status === "open").length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <InsightCard icon={TrendingUp} title="Oportunidades prioritarias" entries={topEntries(opportunity, 12)} empty="Aún no hay señales suficientes." />
        <InsightCard icon={BellPlus} title="Demandas explícitas" entries={topEntries(explicitRequests, 12)} empty="Aún no hay demandas explícitas." />
        <InsightCard icon={Search} title="Búsquedas sin resultado" entries={topEntries(zeroQueries)} empty="Aún no hay búsquedas sin resultado." />
        <InsightCard icon={Search} title="Búsquedas guardadas" entries={topEntries(savedQueries)} empty="Aún no hay búsquedas guardadas." />
        <InsightCard icon={BarChart3} title="Demanda por categoría" entries={topEntries(categoryDemand)} empty="Aún no hay categorías destacadas." />
        <InsightCard icon={BarChart3} title="Demanda por curso" entries={topEntries(gradeDemand)} empty="Aún no hay cursos destacados." />
        <InsightCard icon={MapPin} title="Demanda por región / CP" entries={topEntries(regionDemand)} empty="Aún no hay señales geográficas suficientes." />
        <InsightCard icon={BarChart3} title="Eventos por tipo" entries={topEntries(new Map([...byEvent].map(([k, v]) => [eventLabel(k), v])))} empty="Sin eventos." />
      </div>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h2 className="font-semibold">Cómo usar estos datos</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• Si una búsqueda aparece muchas veces sin resultado, es inventario que debes atraer.</li>
            <li>• Si una demanda explícita se repite, conviértela en campaña: familias, negocios locales o packs.</li>
            <li>• Si una región concentra demanda, prioriza captación local allí.</li>
            <li>• Si un curso o categoría se repite, prepara guías SEO y catálogo guiado por curso.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function InsightCard({
  icon: Icon,
  title,
  entries,
  empty,
}: {
  icon: any;
  title: string;
  entries: Array<[string, number]>;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="space-y-3">
            {entries.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <span className="min-w-0 truncate text-sm font-medium">{label}</span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
