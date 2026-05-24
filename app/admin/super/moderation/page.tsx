import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessSuperadmin } from "@/lib/admin/superadmin-access";
import ModerationFlagActions from "@/components/admin/moderation-flag-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowLeft, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Moderación automática | Wetudy",
  robots: { index: false, follow: false },
};

function severityClassName(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "high":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "medium":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default async function ModerationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");
  if (!(await canAccessSuperadmin(user.id, user.email))) redirect("/account");

  const admin = createAdminClient();

  const { data: flags } = await admin
    .from("moderation_flags")
    .select("id, listing_id, user_id, flag_type, severity, status, reason, metadata, created_at")
    .in("status", ["open", "reviewing"])
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <Button asChild variant="ghost" className="mb-4 gap-2 px-0">
        <Link href="/admin/super">
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </Link>
      </Button>

      <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <ShieldAlert className="h-6 w-6 text-primary" />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Moderación automática</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Cola de anuncios con señales de riesgo: pagos externos, contacto externo, precios sospechosos o baja calidad.
            </p>
          </div>

          <Button asChild>
            <Link href="/api/moderation/scan">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Escanear anuncios
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-4">
        {(flags || []).map((flag: any) => (
          <article key={flag.id} className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={severityClassName(flag.severity)}>
                    {flag.severity}
                  </Badge>
                  <Badge variant="secondary">{flag.flag_type}</Badge>
                  <Badge variant="outline">{flag.status}</Badge>
                </div>

                <h2 className="mt-3 text-lg font-semibold">{flag.reason}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Listing: {flag.listing_id || "sin listing"} · Usuario: {flag.user_id || "sin usuario"}
                </p>

                {flag.listing_id ? (
                  <Button asChild variant="link" className="mt-2 h-auto px-0">
                    <Link href={`/marketplace/listing/${flag.listing_id}`}>Ver anuncio</Link>
                  </Button>
                ) : null}
              </div>

              <ModerationFlagActions id={flag.id} currentStatus={flag.status} />
            </div>
          </article>
        ))}

        {(flags || []).length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card p-8 text-center">
            <h2 className="text-xl font-semibold">No hay avisos abiertos</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ejecuta un escaneo para revisar anuncios recientes.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
