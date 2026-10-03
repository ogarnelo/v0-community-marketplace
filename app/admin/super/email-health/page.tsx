import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CircleCheckBig,
  Clock3,
  MailCheck,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { loadEmailHealth } from "@/lib/admin/email-health";

export const dynamic = "force-dynamic";

const REASON_LABELS: Record<string, string> = {
  hard_bounce: "Rebote permanente",
  soft_bounce_limit: "3 rebotes temporales",
  complaint: "Queja / spam",
  provider_suppressed: "Supresión del proveedor",
  unknown: "Sin clasificar",
};

const STATUS_LABELS: Record<string, string> = {
  delayed: "Retrasado",
  bounced: "Rebotado",
  complained: "Queja",
  failed: "Fallido",
  suppressed: "Suprimido",
};

function pct(value: number | null) {
  return value == null
    ? "—"
    : `${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })}%`;
}

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

export default async function EmailHealthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/admin/super/email-health");

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  if (!roleRows?.length) redirect("/");

  const admin = createAdminClient();
  const [navbarData, health] = await Promise.all([
    getNavbarData(supabase),
    loadEmailHealth(admin, 30),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MailCheck className="h-4 w-4" />
                Super Admin
              </div>
              <h1 className="mt-1 text-2xl font-bold text-foreground">Salud de email</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Entrega transaccional de los últimos {health.windowDays} días y bloqueos activos
                para proteger reputación y evitar reintentos inútiles.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/admin/super">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
          </div>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Envíos registrados</CardDescription>
                <CardTitle className="text-3xl">{health.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Entregados</CardDescription>
                <CardTitle className="flex items-center gap-2 text-3xl">
                  <CircleCheckBig className="h-5 w-5" />
                  {pct(health.deliveryRate)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {health.delivered} de {health.total}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Rebote</CardDescription>
                <CardTitle className="flex items-center gap-2 text-3xl">
                  <TriangleAlert className="h-5 w-5" />
                  {pct(health.bounceRate)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {health.bounced} emails
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Quejas</CardDescription>
                <CardTitle className="flex items-center gap-2 text-3xl">
                  <ShieldAlert className="h-5 w-5" />
                  {pct(health.complaintRate)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {health.complained} emails
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Ban className="h-4 w-4" />
                  Destinatarios bloqueados
                </CardTitle>
                <CardDescription>
                  El pre-send de Wetudy no llama a Resend mientras exista una supresión activa.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-bold">{health.activeSuppressions}</p>
                {health.activeSuppressions === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay destinatarios bloqueados.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(health.suppressionsByReason).map(([reason, count]) => (
                      <Badge key={reason} variant="outline">
                        {REASON_LABELS[reason] || reason}: {count}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Rebote permanente, queja y supresión del proveedor bloquean al instante.
                  Rebotes temporales o indeterminados requieren 3 incidencias.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock3 className="h-4 w-4" />
                  Estado de la ventana
                </CardTitle>
                <CardDescription>
                  Señales operativas agregadas; no se muestran direcciones ni hashes.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                  <p className="mt-1 text-xl font-semibold">{health.pending}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Retrasados</p>
                  <p className="mt-1 text-xl font-semibold">{health.delayed}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Fallidos</p>
                  <p className="mt-1 text-xl font-semibold">{health.failed}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Suprimidos proveedor</p>
                  <p className="mt-1 text-xl font-semibold">{health.providerSuppressed}</p>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Incidencias recientes</CardTitle>
              <CardDescription>
                Últimos estados no saludables del periodo, sin datos personales del destinatario.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {health.recentIssues.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay incidencias de entrega registradas en la ventana.
                </p>
              ) : (
                health.recentIssues.map((row, index) => (
                  <div
                    key={`${row.kind}-${row.sent_at}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{row.kind}</p>
                      <p className="text-xs text-muted-foreground">
                        Enviado {formatDate(row.sent_at)}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {STATUS_LABELS[row.delivery_status] || row.delivery_status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
