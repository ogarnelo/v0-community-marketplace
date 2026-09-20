import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Euro,
  Eye,
  Leaf,
  Recycle,
  School,
  Search,
  Users,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SuperAdminReportSubscriptionForm } from "@/components/admin/super-admin-report-subscription-form";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import {
  loadSuperAdminReport,
  normalizeSuperAdminRange,
  type SuperAdminReportRange,
} from "@/lib/reports/super-admin-report";

export const dynamic = "force-dynamic";

const ranges: Array<{ value: SuperAdminReportRange; label: string }> = [
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
  { value: "365d", label: "12 meses" },
  { value: "total", label: "Histórico" },
];

export default async function SuperAdminSustainabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/admin/super/sustainability");

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  if (!roles?.length) redirect("/");

  const query = await searchParams;
  const range = normalizeSuperAdminRange(query.range);
  const admin = createAdminClient();
  const [navbarData, report, subscriptionResult] = await Promise.all([
    getNavbarData(supabase),
    loadSuperAdminReport(range),
    admin
      .from("super_admin_report_subscriptions")
      .select("email, enabled, frequency_days, report_range, report_format, last_sent_at, next_send_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const subscription = subscriptionResult.error ? null : subscriptionResult.data;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3 gap-2">
                <Link href="/admin/super">
                  <ArrowLeft className="h-4 w-4" />
                  Volver al Super Admin
                </Link>
              </Button>
              <h1 className="text-3xl font-bold tracking-tight">Impacto y sostenibilidad</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Métricas agregadas para explicar el impacto real de Wetudy sin exponer actividad individual.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/api/admin/super/report?format=pdf&range=${range}`}>
                  <Download className="h-4 w-4" />
                  PDF
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/api/admin/super/report?format=csv&range=${range}`}>
                  <Download className="h-4 w-4" />
                  CSV
                </Link>
              </Button>
              <Button asChild className="gap-2">
                <Link href="/admin/super/demand">
                  <Search className="h-4 w-4" />
                  Insights y demanda
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {ranges.map((item) => (
              <Button
                key={item.value}
                asChild
                size="sm"
                variant={range === item.value ? "default" : "outline"}
              >
                <Link href={`/admin/super/sustainability?range=${item.value}`}>
                  {item.label}
                </Link>
              </Button>
            ))}
          </div>

          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-emerald-700" />
                {report.periodLabel}
              </CardTitle>
              <CardDescription>
                Solo se cuentan acuerdos confirmados. El CO₂e se estima únicamente para libros escolares identificables.
              </CardDescription>
            </CardHeader>
          </Card>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <Recycle className="h-5 w-5 text-primary" />
                <p className="mt-3 text-3xl font-bold">{report.impact.confirmedReuses}</p>
                <p className="text-sm text-muted-foreground">Artículos reutilizados confirmados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <Euro className="h-5 w-5 text-primary" />
                <p className="mt-3 text-3xl font-bold">{report.impact.circularValue.toFixed(0)}€</p>
                <p className="text-sm text-muted-foreground">Valor circular acordado</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <Leaf className="h-5 w-5 text-emerald-700" />
                <p className="mt-3 text-3xl font-bold">
                  {report.impact.estimatedAvoidedCo2.toFixed(1)} kg
                </p>
                <p className="text-sm text-muted-foreground">CO₂e potencialmente evitado</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <School className="h-5 w-5 text-primary" />
                <p className="mt-3 text-3xl font-bold">{report.impact.activeSchools}</p>
                <p className="text-sm text-muted-foreground">Centros activos</p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Ventas / donaciones</p>
                <p className="mt-2 text-2xl font-bold">
                  {report.impact.soldItems} / {report.impact.donatedItems}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="mt-2 text-2xl font-bold">{report.impact.totalMembers}</p>
                <p className="text-sm text-muted-foreground">Miembros registrados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Anuncios activos</p>
                <p className="mt-2 text-2xl font-bold">{report.impact.activeListings}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <p className="mt-2 text-2xl font-bold">{report.impact.listingViews}</p>
                <p className="text-sm text-muted-foreground">Visitas a anuncios</p>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Informe periódico por email</CardTitle>
              <CardDescription>
                Elige cada 7, 15 o 30 días, el rango de datos y si quieres PDF, CSV o ambos.
                {subscription?.last_sent_at
                  ? ` Último envío: ${new Intl.DateTimeFormat("es-ES", {
                      timeZone: "Europe/Madrid",
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(subscription.last_sent_at))}.`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SuperAdminReportSubscriptionForm
                initialEmail={subscription?.email || user.email || ""}
                initialEnabled={subscription?.enabled === true}
                initialFrequencyDays={subscription?.frequency_days || 30}
                initialRange={subscription?.report_range || range}
                initialFormat={subscription?.report_format || "both"}
              />
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Qué podemos defender hoy</CardTitle>
                <CardDescription>
                  Datos internos medidos directamente en Wetudy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span>Libros incluidos en estimación ambiental</span>
                  <strong>{report.impact.reusedBooks}</strong>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span>Artículos reutilizados sin factor específico</span>
                  <strong>{report.impact.unquantifiedItems}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Búsquedas de usuarios en el periodo</span>
                  <strong>{report.demand.searches}</strong>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Metodología y límites</CardTitle>
                <CardDescription>
                  Para no sobredimensionar el impacto antes de disponer de más datos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  El CO₂e se presenta como estimación potencialmente evitada, separada de las métricas reales de uso.
                </p>
                <p>
                  Solo se aplica el factor vigente a libros escolares identificables. Mochilas, uniformes, calculadoras y otras categorías permanecen sin factor específico.
                </p>
                <p>
                  El panel es agregado: no muestra mensajes, conversaciones ni acuerdos individuales.
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
