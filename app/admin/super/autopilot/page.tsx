import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessSuperadmin } from "@/lib/admin/superadmin-access";
import AutopilotRecommendationActions from "@/components/admin/autopilot-recommendation-actions";
import { Button } from "@/components/ui/button";
import AdminApiRunButton from "@/components/admin/admin-api-run-button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bot, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Autopilot Growth | Wetudy",
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

export default async function AutopilotPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");
  if (!(await canAccessSuperadmin(user.id, user.email))) redirect("/account");

  const admin = createAdminClient();
  const { data: recommendations } = await admin
    .from("autopilot_recommendations")
    .select("*")
    .neq("status", "done")
    .neq("status", "dismissed")
    .order("impact_score", { ascending: false })
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
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Autopilot Growth</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Recomendaciones automáticas para generar liquidez, captar negocios, activar demanda, mejorar SEO y mantener confianza.
            </p>
          </div>

          <AdminApiRunButton
            endpoint="/api/autopilot/run"
            label="Generar recomendaciones"
            icon={<Sparkles className="mr-2 h-4 w-4" />}
          />
        </div>
      </section>

      <div className="grid gap-4">
        {(recommendations || []).map((item: any) => (
          <article key={item.id} className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={severityClassName(item.severity)}>
                    {item.severity}
                  </Badge>
                  <Badge variant="secondary">{item.recommendation_type}</Badge>
                  <Badge variant="outline">impacto {item.impact_score}</Badge>
                </div>
                <h2 className="mt-3 text-lg font-semibold">{item.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                {item.href ? (
                  <Button asChild variant="link" className="mt-2 h-auto px-0">
                    <Link href={item.href}>{item.action_label || "Abrir"}</Link>
                  </Button>
                ) : null}
              </div>

              <AutopilotRecommendationActions id={item.id} currentStatus={item.status} />
            </div>
          </article>
        ))}

        {(recommendations || []).length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card p-8 text-center">
            <h2 className="text-xl font-semibold">No hay recomendaciones abiertas</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ejecuta el autopilot para generar nuevas acciones.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
