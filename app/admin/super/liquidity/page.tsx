import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Activity, Search, MessageCircle, Handshake, Timer, PackagePlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildLiquidityRows,
  combineLiquidityRows,
  type LiquidityAgreement,
  type LiquidityAction,
  type LiquidityListing,
  type LiquidityNeed,
  type LiquidityProfile,
  type LiquiditySchool,
  type LiquiditySearch,
  type RateMetric,
} from "@/lib/admin/liquidity-metrics";

export const dynamic = "force-dynamic";

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function periodStart(period: string) {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : null;
  if (!days) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function formatRate(metric: RateMetric) {
  return metric.rate == null ? "—" : `${Math.round(metric.rate * 100)}%`;
}

function SampleBadge({ metric }: { metric: RateMetric }) {
  if (metric.denominator === 0) return <Badge variant="outline">sin muestra</Badge>;
  if (metric.lowSample) return <Badge variant="outline">muestra baja · n={metric.denominator}</Badge>;
  return <span className="text-xs text-muted-foreground">n={metric.denominator}</span>;
}

function formatDuration(hours: number | null) {
  if (hours == null) return "—";
  if (hours < 24) return `${Math.round(hours * 10) / 10} h`;
  return `${Math.round((hours / 24) * 10) / 10} d`;
}

export default async function LiquidityDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/super/liquidity");

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);
  if (!roles?.length) redirect("/");

  const params = await searchParams;
  const period = param(params.period) || "30d";
  const schoolId = param(params.school);
  const category = param(params.category);
  const gradeLevel = param(params.grade);
  const isbn = param(params.isbn);
  const start = periodStart(period);
  const admin = createAdminClient();

  const [
    navbarData,
    profilesResult,
    listingsResult,
    searchesResult,
    needsResult,
    agreementsResult,
    actionsResult,
    schoolsResult,
  ] = await Promise.all([
    getNavbarData(supabase),
    admin.from("profiles").select("id,user_type,school_id,created_at").limit(10000).returns<LiquidityProfile[]>(),
    admin.from("listings").select("id,seller_id,school_id,category,grade_level,isbn,status,created_at").limit(10000).returns<LiquidityListing[]>(),
    admin.from("marketplace_search_events").select("id,user_id,school_id,category,grade_level,isbn_query,results_count,created_at").limit(10000).returns<LiquiditySearch[]>(),
    admin.from("demand_requests").select("id,user_id,school_id,category,grade_level,isbn,created_at,first_result_at,first_contact_at,first_agreement_at,resolved_at").limit(10000).returns<LiquidityNeed[]>(),
    admin.from("agreements").select("id,listing_id,buyer_id,seller_id,school_id,status,created_at,confirmed_at").limit(10000).returns<LiquidityAgreement[]>(),
    admin.from("demand_opportunity_actions").select("id,target_user_id,resulting_listing_id,sent_at,responded_at,created_at").eq("action_type","seller_contacted").limit(10000).returns<LiquidityAction[]>(),
    admin.from("schools").select("id,name,city,is_active").order("name").limit(5000).returns<LiquiditySchool[]>(),
  ]);

  const profiles = profilesResult.data || [];
  const listings = listingsResult.data || [];
  const searches = searchesResult.data || [];
  const needs = needsResult.data || [];
  const agreements = agreementsResult.data || [];
  const actions = actionsResult.data || [];
  const schools = schoolsResult.data || [];

  const rows = buildLiquidityRows(
    { profiles, listings, searches, needs, agreements, actions, schools },
    { periodStart: start, schoolId: schoolId || null, category: category || null, gradeLevel: gradeLevel || null, isbn: isbn || null }
  );
  const total = combineLiquidityRows(rows);

  const categories = Array.from(new Set([
    ...listings.map((row) => row.category),
    ...searches.map((row) => row.category),
    ...needs.map((row) => row.category),
  ].filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "es"));

  const grades = Array.from(new Set([
    ...listings.map((row) => row.grade_level),
    ...searches.map((row) => row.grade_level),
    ...needs.map((row) => row.grade_level),
  ].filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="flex-1">
        <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 gap-2">
                <Link href="/admin/super"><ArrowLeft className="h-4 w-4" /> Volver al Super Admin</Link>
              </Button>
              <p className="text-sm font-medium text-primary">Cockpit empresarial</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Liquidez</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Datos crudos para medir el recorrido necesidad → contacto → acuerdo. No se calcula ningún score arbitrario de centro.
              </p>
            </div>
            <Button asChild variant="outline"><Link href="/admin/super/demand">Insights y demanda</Link></Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtros</CardTitle>
              <CardDescription>Segmenta por periodo, centro, categoría, curso e ISBN.</CardDescription>
            </CardHeader>
            <CardContent>
              <form method="get" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <select name="period" defaultValue={period} className="h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="7d">Últimos 7 días</option>
                  <option value="30d">Últimos 30 días</option>
                  <option value="90d">Últimos 90 días</option>
                  <option value="all">Todo el histórico</option>
                </select>
                <select name="school" defaultValue={schoolId} className="h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="">Todos los centros</option>
                  {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                </select>
                <select name="category" defaultValue={category} className="h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="">Todas las categorías</option>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select name="grade" defaultValue={gradeLevel} className="h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="">Todos los cursos</option>
                  {grades.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <input name="isbn" defaultValue={isbn} placeholder="ISBN" className="h-10 rounded-md border bg-background px-3 text-sm" />
                <Button type="submit" className="h-10">Aplicar</Button>
              </form>
            </CardContent>
          </Card>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <Card><CardContent className="p-4"><Users className="h-4 w-4 text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">Familias vinculadas</p><p className="mt-1 text-2xl font-bold">{total.linkedFamilies}</p><p className="text-xs text-muted-foreground">{total.activeFamilies} activas en periodo</p></CardContent></Card>
            <Card><CardContent className="p-4"><PackagePlus className="h-4 w-4 text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">Anuncios activos</p><p className="mt-1 text-2xl font-bold">{total.activeListings}</p><p className="text-xs text-muted-foreground">{total.listingsPer100Families == null ? "—" : total.listingsPer100Families.toFixed(1)} / 100 familias</p></CardContent></Card>
            <Card><CardContent className="p-4"><Search className="h-4 w-4 text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">Búsquedas</p><p className="mt-1 text-2xl font-bold">{total.searches}</p><p className="text-xs text-muted-foreground">{total.needs} necesidades</p></CardContent></Card>
            <Card><CardContent className="p-4"><Activity className="h-4 w-4 text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">Search Success</p><p className="mt-1 text-2xl font-bold">{formatRate(total.searchSuccess)}</p><SampleBadge metric={total.searchSuccess} /></CardContent></Card>
            <Card><CardContent className="p-4"><MessageCircle className="h-4 w-4 text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">Need → Contact</p><p className="mt-1 text-2xl font-bold">{formatRate(total.needToContact)}</p><SampleBadge metric={total.needToContact} /></CardContent></Card>
            <Card><CardContent className="p-4"><Handshake className="h-4 w-4 text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">Contact → Agreement</p><p className="mt-1 text-2xl font-bold">{formatRate(total.contactToAgreement)}</p><SampleBadge metric={total.contactToAgreement} /></CardContent></Card>
            <Card><CardContent className="p-4"><Timer className="h-4 w-4 text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">NR14</p><p className="mt-1 text-2xl font-bold">{formatRate(total.nr14)}</p><SampleBadge metric={total.nr14} /></CardContent></Card>
            <Card><CardContent className="p-4"><PackagePlus className="h-4 w-4 text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">Supply B1</p><p className="mt-1 text-2xl font-bold">{total.b1SupplyCreated}</p><p className="text-xs text-muted-foreground">{formatRate(total.activatedSellerToListing)} seller → listing</p></CardContent></Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Liquidez por centro</CardTitle>
              <CardDescription>
                “Familia activa” = perfil parent vinculado que buscó, expresó necesidad, publicó o participó en un acuerdo durante el periodo. Los anuncios activos son un snapshot actual. “—” significa denominador cero; n&lt;5 se marca como muestra baja.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay datos para los filtros seleccionados.</p>
              ) : (
                <table className="w-full min-w-[1500px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-2 py-3">Centro</th>
                      <th className="px-2 py-3">Familias</th>
                      <th className="px-2 py-3">Activas</th>
                      <th className="px-2 py-3">Listings</th>
                      <th className="px-2 py-3">/100</th>
                      <th className="px-2 py-3">Búsq.</th>
                      <th className="px-2 py-3">Neces.</th>
                      <th className="px-2 py-3">Success</th>
                      <th className="px-2 py-3">Zero</th>
                      <th className="px-2 py-3">Need→Contact</th>
                      <th className="px-2 py-3">Contact→Agr.</th>
                      <th className="px-2 py-3">NR7</th>
                      <th className="px-2 py-3">NR14</th>
                      <th className="px-2 py-3">T. contacto</th>
                      <th className="px-2 py-3">T. acuerdo</th>
                      <th className="px-2 py-3">Acuerdos</th>
                      <th className="px-2 py-3">Sin cubrir</th>
                      <th className="px-2 py-3">Supply B1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.schoolId} className="border-b align-top">
                        <td className="px-2 py-3 font-medium">{row.schoolName}</td>
                        <td className="px-2 py-3">{row.linkedFamilies}</td>
                        <td className="px-2 py-3">{row.activeFamilies}</td>
                        <td className="px-2 py-3">{row.activeListings}</td>
                        <td className="px-2 py-3">{row.listingsPer100Families == null ? "—" : row.listingsPer100Families.toFixed(1)}</td>
                        <td className="px-2 py-3">{row.searches}</td>
                        <td className="px-2 py-3">{row.needs}</td>
                        <td className="px-2 py-3">{formatRate(row.searchSuccess)}{row.searchSuccess.lowSample ? " · baja" : ""}</td>
                        <td className="px-2 py-3">{formatRate(row.zeroResult)}{row.zeroResult.lowSample ? " · baja" : ""}</td>
                        <td className="px-2 py-3">{formatRate(row.needToContact)}{row.needToContact.lowSample ? " · baja" : ""}</td>
                        <td className="px-2 py-3">{formatRate(row.contactToAgreement)}{row.contactToAgreement.lowSample ? " · baja" : ""}</td>
                        <td className="px-2 py-3">{formatRate(row.nr7)}{row.nr7.lowSample ? " · baja" : ""}</td>
                        <td className="px-2 py-3">{formatRate(row.nr14)}{row.nr14.lowSample ? " · baja" : ""}</td>
                        <td className="px-2 py-3">{formatDuration(row.medianTimeToContactHours)}</td>
                        <td className="px-2 py-3">{formatDuration(row.medianTimeToAgreementHours)}</td>
                        <td className="px-2 py-3">{row.confirmedAgreements}</td>
                        <td className="px-2 py-3">{row.unmetNeeds}</td>
                        <td className="px-2 py-3">{row.b1SupplyCreated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Definiciones operativas</CardTitle>
              <CardDescription>Las métricas son descriptivas y se mantienen sin score compuesto hasta tener muestra real de pilotos.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
              <p><strong className="text-foreground">Search Success Rate:</strong> búsquedas con al menos un resultado / búsquedas con conteo disponible.</p>
              <p><strong className="text-foreground">Zero Result Rate:</strong> búsquedas con 0 resultados / búsquedas con conteo disponible.</p>
              <p><strong className="text-foreground">Need → Contact:</strong> necesidades con contacto atribuible / necesidades válidas expresadas.</p>
              <p><strong className="text-foreground">Contact → Agreement:</strong> necesidades con acuerdo iniciado / necesidades que llegaron a contacto.</p>
              <p><strong className="text-foreground">NR7 / NR14:</strong> necesidades con acuerdo confirmado dentro de 7/14 días / necesidades válidas expresadas.</p>
              <p><strong className="text-foreground">Supply B1:</strong> listings creados por vendedores activados manualmente desde una oportunidad de demanda.</p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
