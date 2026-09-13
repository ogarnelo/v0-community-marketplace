import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search, TrendingUp, AlertTriangle, School } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = ["oscar_garnelo@hotmail.com"];

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

  const email = user.email?.toLowerCase() || "";
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  const isSuperAdmin = ADMIN_EMAILS.includes(email) || Boolean(roleRows?.length);
  if (!isSuperAdmin) redirect("/");

  const [profileResult, eventResult, summaryResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("id", user.id).maybeSingle<ProfileRow>(),
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
  ]);

  const events = eventResult.data || [];
  const summary = summaryResult.data || [];
  const zeroResults = events.filter((event) => (event.results_count || 0) === 0).length;
  const navbarUserName = profileResult.data?.full_name || user.email || "Super Admin";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar isLoggedIn userName={navbarUserName} isAdmin isSuperAdmin adminHref="/admin/super" currentUserId={user.id} />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3 gap-2">
                <Link href="/admin/super/mvp"><ArrowLeft className="h-4 w-4" /> Volver al dashboard MVP</Link>
              </Button>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Demand intelligence</h1>
              <p className="text-sm text-muted-foreground">
                Señales de búsqueda, filtros sin resultados y oportunidades por categoría/curso.
              </p>
            </div>
            <Badge variant={zeroResults ? "destructive" : "secondary"} className="w-fit gap-2 px-3 py-1">
              {zeroResults ? <AlertTriangle className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {zeroResults ? `${zeroResults} búsquedas sin resultado recientes` : "Sin huecos detectados"}
            </Badge>
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
