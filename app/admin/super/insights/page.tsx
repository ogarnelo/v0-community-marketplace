import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, BarChart3, MapPin, Search, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

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
    default:
      return eventType;
  }
}

export default async function DemandInsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .maybeSingle();

  if (!role) redirect("/account");

  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("demand_events")
    .select("id, event_type, normalized_query, category, grade_level, result_count, postal_prefix, region, school_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1500);

  const events = ((data || []) as DemandEvent[]);

  const byEvent = new Map<string, number>();
  const zeroQueries = new Map<string, number>();
  const savedQueries = new Map<string, number>();
  const categoryDemand = new Map<string, number>();
  const gradeDemand = new Map<string, number>();
  const regionDemand = new Map<string, number>();
  const opportunity = new Map<string, number>();

  for (const event of events) {
    increment(byEvent, event.event_type);

    const query = event.normalized_query || "";
    const category = event.category || "";
    const grade = event.grade_level || "";
    const region = event.region || event.postal_prefix || "";

    if (event.event_type === "zero_result_search") {
      increment(zeroQueries, query || `${category || "sin categoria"} · ${grade || "sin curso"}`);
      increment(opportunity, `${query || category || "demanda"} · ${grade || "sin curso"}`, 4);
    }

    if (event.event_type === "saved_search_created") {
      increment(savedQueries, query || `${category || "sin categoria"} · ${grade || "sin curso"}`);
      increment(opportunity, `${query || category || "demanda"} · ${grade || "sin curso"}`, 3);
    }

    if (["search_performed", "zero_result_search", "saved_search_created"].includes(event.event_type)) {
      if (category) increment(categoryDemand, category);
      if (grade) increment(gradeDemand, grade);
      if (region) increment(regionDemand, region);
      if ((event.result_count || 0) <= 2 && (query || category)) {
        increment(opportunity, `${query || category} · ${grade || "sin curso"}`, 1);
      }
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Demand Intelligence</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Señales de demanda de los últimos 30 días: búsquedas, búsquedas sin resultado,
            búsquedas guardadas, categorías, cursos y regiones.
          </p>
        </div>
      </div>

      {error ? (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="flex gap-3 p-5 text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>
              No se pudieron cargar eventos de demanda. Asegúrate de aplicar la migración
              <code className="mx-1">20260502190000_demand_intelligence.sql</code>.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Eventos 30 días</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{events.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Demanda de búsqueda</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalSearchDemand}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sin resultado</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{byEvent.get("zero_result_search") || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Guardadas</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{byEvent.get("saved_search_created") || 0}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <InsightCard icon={Search} title="Búsquedas sin resultado" entries={topEntries(zeroQueries)} empty="Aún no hay búsquedas sin resultado." />
        <InsightCard icon={TrendingUp} title="Oportunidades de oferta" entries={topEntries(opportunity)} empty="Aún no hay señales suficientes." />
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
            <li>• Si una región concentra demanda, prioriza captación de negocios y familias allí.</li>
            <li>• Si un curso o categoría se repite, prepara packs, guías SEO y campañas específicas.</li>
            <li>• Si muchas búsquedas se guardan, hay intención fuerte aunque no haya oferta todavía.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
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
