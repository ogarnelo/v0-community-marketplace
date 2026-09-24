import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Search, Users, Package, BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import {
  activationMessage,
  findDemandOpportunity,
  findSupplyCandidates,
} from "@/lib/admin/demand-opportunities";
import { DemandCandidateActivation } from "@/components/admin/demand-candidate-activation";

export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const STATUS_LABELS: Record<string, string> = {
  new: "Nueva",
  offer_search: "Buscando oferta",
  sellers_contacted: "Vendedores contactados",
  supply_generated: "Oferta generada",
  satisfied: "Satisfecha",
  closed: "Cerrada",
  suggested: "Nueva",
};

export default async function DemandOpportunityPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?next=/admin/super/demand/opportunity/${encodeURIComponent(key)}`);

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);
  if (!roles?.length) redirect("/");

  const admin = createAdminClient();
  const [navbarData, opportunity] = await Promise.all([
    getNavbarData(supabase),
    findDemandOpportunity(admin, key),
  ]);
  if (!opportunity) notFound();

  const [candidates, actionResult] = await Promise.all([
    findSupplyCandidates(admin, opportunity),
    admin
      .from("demand_opportunity_actions")
      .select("id,target_user_id,sent_at,responded_at,response,resulting_listing_id")
      .eq("opportunity_key", opportunity.key)
      .eq("action_type", "seller_contacted")
      .order("created_at", { ascending: false }),
  ]);

  const actions = actionResult.data || [];
  const contacted = new Set(actions.map((action: any) => action.target_user_id).filter(Boolean)).size;
  const responded = actions.filter((action: any) => action.responded_at).length;
  const generatedListings = new Set(actions.map((action: any) => action.resulting_listing_id).filter(Boolean)).size;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 lg:px-8">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 gap-2">
              <Link href="/admin/super/demand"><ArrowLeft className="h-4 w-4" /> Volver a Insights y demanda</Link>
            </Button>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-primary">Oportunidad de demanda</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{opportunity.title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {[opportunity.schoolName, opportunity.category, opportunity.gradeLevel, opportunity.isbn ? `ISBN ${opportunity.isbn}` : null]
                    .filter(Boolean)
                    .join(" · ") || "Sin atributos adicionales"}
                </p>
              </div>
              <Badge variant="outline">{STATUS_LABELS[opportunity.status] || opportunity.status}</Badge>
            </div>
          </div>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Familias interesadas</p><p className="mt-1 text-2xl font-bold">{opportunity.familiesCount}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Búsquedas / señales</p><p className="mt-1 text-2xl font-bold">{opportunity.searchesCount}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Oferta actual compatible</p><p className="mt-1 text-2xl font-bold">{opportunity.supplyCount}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Última demanda</p><p className="mt-1 text-sm font-semibold">{formatDate(opportunity.lastSeenAt)}</p></CardContent></Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4" /> Resultado de activación</CardTitle>
              <CardDescription>Seguimiento manual de esta oportunidad. No se envían campañas automáticas.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Candidatos contactados</p><p className="mt-1 text-2xl font-bold">{contacted}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Respondieron</p><p className="mt-1 text-2xl font-bold">{responded}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Anuncios generados</p><p className="mt-1 text-2xl font-bold">{generatedListings}</p></div>
            </CardContent>
          </Card>

          <Card id="candidates">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Buscar oferta potencial</CardTitle>
              <CardDescription>
                Solo aparecen usuarios con historial de publicación y señales fuertes de afinidad. Se excluyen demandantes, estudiantes, usuarios contactados recientemente y vendedores con reportes abiertos sobre sus anuncios.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DemandCandidateActivation
                opportunityKey={opportunity.key}
                candidates={candidates}
                message={activationMessage(opportunity)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4" /> Identidad de la necesidad</CardTitle>
              <CardDescription>Fingerprint determinista usado para agrupar señales equivalentes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Primera señal: {formatDate(opportunity.firstSeenAt)}</p>
              <p>Fuentes explícitas agrupadas: {opportunity.sourceIds.length}</p>
              <p className="break-all font-mono text-xs">{opportunity.key}</p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
