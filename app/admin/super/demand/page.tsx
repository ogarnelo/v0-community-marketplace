import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, Leaf, Search, TrendingUp, AlertTriangle, School, Users, Package, Handshake, MousePointerClick, MessageCircleQuestion, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { buildDemandActionLabel, buildDemandInsights, buildSeoDemandActionLabel, buildSeoDemandOpportunities } from "@/lib/admin/demand-insights";
import { buildAcquisitionSummaries, type AcquisitionEvent } from "@/lib/admin/growth-insights";

export const dynamic = "force-dynamic";


type DemandEvent = {
  id: string;
  query: string | null;
  isbn_query: string | null;
  category: string | null;
  grade_level: string | null;
  listing_type: string | null;
  results_count: number | null;
  only_my_community: boolean | null;
  created_at: string;
  school_id: string | null;
};

type ProfileRow = { id: string; full_name: string | null };
type SummaryRow = {
  category: string;
  grade_level: string;
  searches_count: number;
  zero_result_searches: number;
  last_seen_at: string | null;
};

type ExplicitDemandRow = {
  id: string;
  query: string | null;
  isbn_query: string | null;
  category: string | null;
  grade_level: string | null;
  need_details: string | null;
  results_count: number;
  created_at: string;
};

type ConversationOutcomeRow = {
  reason: string;
  feedback_role: "buyer" | "seller";
  created_at: string;
};

const OUTCOME_REASON_LABELS: Record<string, string> = {
  bought_here: "Compró / recibió el artículo",
  unavailable: "Ya no estaba disponible",
  seller_no_response: "El vendedor no respondió",
  price: "No acordaron el precio",
  distance: "Demasiado lejos",
  found_other: "Encontró otra opción",
  no_longer_needed: "Ya no lo necesitaba",
  sold_here: "Lo vendió / entregó a esa persona",
  sold_elsewhere: "Lo vendió por otro medio",
  still_available: "El artículo sigue disponible",
  buyer_no_response: "El comprador dejó de responder",
  decided_not_to_sell: "Decidió no venderlo",
  other: "Otro motivo",
};

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function pct(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default async function DemandIntelligencePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) redirect("/auth?next=/admin/super/demand");

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  if (!roleRows?.length) redirect("/");

  const acquisitionSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [navbarData, profileResult, eventResult, summaryResult, acquisitionResult, explicitDemandResult, conversationOutcomeResult] = await Promise.all([
    getNavbarData(supabase),
    supabase.from("profiles").select("id, full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("marketplace_search_events")
      .select("id, query, isbn_query, category, grade_level, listing_type, results_count, only_my_community, created_at, school_id")
      .order("created_at", { ascending: false })
      .limit(80)
      .returns<DemandEvent[]>(),
    supabase
      .from("marketplace_demand_summary")
      .select("category, grade_level, searches_count, zero_result_searches, last_seen_at")
      .order("zero_result_searches", { ascending: false })
      .limit(20)
      .returns<SummaryRow[]>(),
    supabase
      .from("growth_acquisition_events")
      .select("event_type, user_id, source, medium, campaign, created_at")
      .gte("created_at", acquisitionSince)
      .order("created_at", { ascending: false })
      .limit(5000)
      .returns<AcquisitionEvent[]>(),
    supabase
      .from("saved_searches")
      .select("id, query, isbn_query, category, grade_level, need_details, results_count, created_at")
      .eq("results_count", 0)
      .eq("intent_source", "zero_results_prompt")
      .order("created_at", { ascending: false })
      .limit(40)
      .returns<ExplicitDemandRow[]>(),
    supabase
      .from("conversation_outcome_feedback")
      .select("reason, feedback_role, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<ConversationOutcomeRow[]>(),
  ]);

  const events = eventResult.data || [];
  const summary = summaryResult.data || [];
  const zeroResults = events.filter((event) => (event.results_count || 0) === 0).length;
  const actionableInsights = buildDemandInsights(events)
    .filter((insight) => insight.zeroResults > 0)
    .slice(0, 12);
  const seoOpportunities = buildSeoDemandOpportunities(events).slice(0, 8);
  const acquisitionEvents = acquisitionResult.data || [];
  const explicitDemands = explicitDemandResult.data || [];
  const conversationOutcomes = conversationOutcomeResult.data || [];
  const outcomeReasonCounts = Array.from(
    conversationOutcomes.reduce((map, item) => {
      map.set(item.reason, (map.get(item.reason) || 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const acquisitionSummary = buildAcquisitionSummaries(acquisitionEvents).slice(0, 10);
  const acquisitionTotals = {
    landings: acquisitionEvents.filter((event) => event.event_type === "landing").length,
    users: acquisitionEvents.filter((event) => event.event_type === "attributed_user").length,
    listings: acquisitionEvents.filter((event) => event.event_type === "listing_published").length,
    agreements: acquisitionEvents.filter((event) => event.event_type === "agreement_confirmed").length,
  };
  const profile = (profileResult.data as ProfileRow | null) ?? null;
  const navbarUserName = profile?.full_name || user.email || "Super Admin";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3 gap-2">
                <Link href="/admin/super"><ArrowLeft className="h-4 w-4" /> Volver al Super Admin</Link>
              </Button>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Insights y demanda</h1>
              <p className="text-sm text-muted-foreground">
                Señales de búsqueda, filtros sin resultados y oportunidades de producto por categoría y curso.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href="/api/admin/super/report?format=pdf&range=90d">
                  <Download className="h-4 w-4" />
                  Informe PDF
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href="/api/admin/super/report?format=csv&range=90d">
                  <Download className="h-4 w-4" />
                  CSV
                </Link>
              </Button>
              <Button asChild size="sm" className="gap-2">
                <Link href="/admin/super/sustainability">
                  <Leaf className="h-4 w-4" />
                  Sostenibilidad
                </Link>
              </Button>
              <Badge variant={zeroResults ? "destructive" : "secondary"} className="w-fit gap-2 px-3 py-1">
                {zeroResults ? <AlertTriangle className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                {zeroResults ? `${zeroResults} búsquedas sin resultado recientes` : "Sin huecos detectados"}
              </Badge>
            </div>
          </div>

          <section className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Búsquedas registradas</p>
                <p className="mt-2 text-3xl font-bold">{events.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Últimas 80 señales capturadas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Sin resultados</p>
                <p className="mt-2 text-3xl font-bold">{zeroResults}</p>
                <p className="mt-1 text-xs text-muted-foreground">{pct(zeroResults, events.length)} de señales recientes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Filtro comunidad</p>
                <p className="mt-2 text-3xl font-bold">{events.filter((event) => event.only_my_community).length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Veces que se priorizó el centro</p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4" /> Demanda explícita
                </CardTitle>
                <CardDescription>
                  Familias que encontraron 0 resultados y confirmaron qué necesitaban. Estas señales todavía no activan vendedores automáticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {explicitDemands.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todavía no hay demandas explícitas guardadas desde búsquedas vacías.</p>
                ) : null}
                {explicitDemands.slice(0, 8).map((demand) => (
                  <div key={demand.id} className="rounded-xl border p-3">
                    <p className="font-medium text-foreground">
                      {demand.need_details || demand.query || demand.isbn_query || demand.category || demand.grade_level || "Necesidad sin detalle"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[demand.category, demand.grade_level, demand.isbn_query].filter(Boolean).join(" · ") || "Sin filtros adicionales"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDate(demand.created_at)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageCircleQuestion className="h-4 w-4" /> Conversaciones que no avanzaron
                </CardTitle>
                <CardDescription>
                  Motivos declarados por compradores y vendedores después de al menos 7 días sin actividad.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {conversationOutcomes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todavía no hay respuestas sobre conversaciones inactivas.</p>
                ) : null}
                {outcomeReasonCounts.map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <p className="text-sm font-medium text-foreground">
                      {OUTCOME_REASON_LABELS[reason] || reason}
                    </p>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
                {conversationOutcomes.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {conversationOutcomes.length} respuestas registradas · comprador {conversationOutcomes.filter((item) => item.feedback_role === "buyer").length} · vendedor {conversationOutcomes.filter((item) => item.feedback_role === "seller").length}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MousePointerClick className="h-4 w-4" /> Adquisición y conversión · 90 días
              </CardTitle>
              <CardDescription>
                Tráfico atribuible por UTM o referencia externa y conversiones posteriores. El tráfico directo sin señal de origen no se fuerza a ninguna campaña.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><MousePointerClick className="h-3.5 w-3.5" /> Visitas atribuibles</div><p className="mt-1 text-2xl font-bold">{acquisitionTotals.landings}</p></div>
                <div className="rounded-xl border p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Usuarios atribuidos</div><p className="mt-1 text-2xl font-bold">{acquisitionTotals.users}</p></div>
                <div className="rounded-xl border p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="h-3.5 w-3.5" /> Publicaciones</div><p className="mt-1 text-2xl font-bold">{acquisitionTotals.listings}</p></div>
                <div className="rounded-xl border p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Handshake className="h-3.5 w-3.5" /> Acuerdos</div><p className="mt-1 text-2xl font-bold">{acquisitionTotals.agreements}</p></div>
              </div>

              <div className="space-y-3">
                {acquisitionSummary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todavía no hay tráfico con UTM o referencia externa suficiente para atribuir.</p>
                ) : null}
                {acquisitionSummary.map((row) => (
                  <div key={`${row.source}-${row.medium}-${row.campaign}`} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{row.source}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{row.medium} · {row.campaign}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Última señal {formatDate(row.lastSeenAt)}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {row.landings} visitas · {row.users} usuarios · {row.listings} publicaciones · {row.agreements} acuerdos · {row.schoolJoins} vinculaciones a centro
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" /> Prioridades accionables</CardTitle>
              <CardDescription>Señales con búsquedas sin resultado, ordenadas para decidir captación y refuerzo de oferta.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {actionableInsights.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay prioridades pendientes con las señales recientes.</p>
              ) : null}
              {actionableInsights.map((insight) => (
                <div key={`${insight.kind}-${insight.label}`} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{insight.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {insight.zeroResults} sin resultado · {insight.searches} búsquedas · última {formatDate(insight.lastSeenAt)}
                      </p>
                    </div>
                    <Badge variant="outline">{buildDemandActionLabel(insight)}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4" /> Oportunidades SEO basadas en demanda real</CardTitle>
              <CardDescription>
                Solo aparecen consultas repetidas (2+ búsquedas) con al menos un resultado vacío. Sirven para decidir si reforzar oferta y, cuando haya contenido útil suficiente, crear o actualizar una guía; no generan páginas automáticas.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {seoOpportunities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay una consulta repetida con suficiente señal para priorizar contenido SEO.</p>
              ) : null}
              {seoOpportunities.map((insight) => (
                <div key={`seo-${insight.label}`} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{insight.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {insight.searches} búsquedas · {insight.zeroResults} sin resultado · última {formatDate(insight.lastSeenAt)}
                      </p>
                    </div>
                    <Badge variant="outline">{buildSeoDemandActionLabel(insight)}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Huecos de oferta</CardTitle>
                <CardDescription>Ordenado por búsquedas sin resultados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {summary.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay señales suficientes.</p> : null}
                {summary.map((row) => (
                  <div key={`${row.category}-${row.grade_level}`} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">{row.category}</p>
                      <Badge variant={row.zero_result_searches ? "destructive" : "secondary"}>{row.zero_result_searches} sin resultado</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{row.grade_level} · {row.searches_count} búsquedas · última {formatDate(row.last_seen_at)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4" /> Señales recientes</CardTitle>
                <CardDescription>Qué intenta encontrar la comunidad ahora mismo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {events.length === 0 ? <p className="text-sm text-muted-foreground">Haz búsquedas en el marketplace para empezar a poblar este panel.</p> : null}
                {events.slice(0, 20).map((event) => (
                  <div key={event.id} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-medium text-foreground">
                        {event.query || event.isbn_query || event.category || "Filtro aplicado"}
                      </p>
                      <Badge variant={(event.results_count || 0) === 0 ? "destructive" : "secondary"}>{event.results_count ?? 0} resultados</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[event.category, event.grade_level, event.listing_type].filter(Boolean).join(" · ") || "Sin filtros de catálogo"}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <School className="h-3.5 w-3.5" /> {event.only_my_community ? "Solo mi comunidad" : "Todas las comunidades"} · {formatDate(event.created_at)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
