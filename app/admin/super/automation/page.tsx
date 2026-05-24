import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessSuperadmin } from "@/lib/admin/superadmin-access";
import { AUTOMATION_JOBS } from "@/lib/automation/jobs";
import AutomationRunButton from "@/components/automation/automation-run-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bot, CheckCircle2, Clock3, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Automation Command Center | Wetudy",
  robots: {
    index: false,
    follow: false,
  },
};

function statusClassName(status: string) {
  switch (status) {
    case "succeeded":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "failed":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "running":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === "succeeded") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-rose-600" />;
  return <Clock3 className="h-4 w-4 text-muted-foreground" />;
}

export default async function AutomationCommandCenterPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");
  if (!(await canAccessSuperadmin(user.id, user.email))) redirect("/account");

  const admin = createAdminClient();

  const { data: runs } = await admin
    .from("automation_runs")
    .select("id, job_id, job_name, status, trigger_source, ok, message, error, duration_ms, started_at, finished_at")
    .order("started_at", { ascending: false })
    .limit(50);

  const latestByJob = new Map<string, any>();
  for (const run of runs || []) {
    if (!latestByJob.has(run.job_id)) latestByJob.set(run.job_id, run);
  }

  const failedCount = (runs || []).filter((run: any) => run.status === "failed").length;
  const lastRun = (runs || [])[0];

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
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Automation Command Center</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Ejecuta y vigila tareas automáticas de Wetudy: healthchecks, keepalive, SEO programático e inteligencia de demanda.
            </p>
          </div>

          <AutomationRunButton runAll />
        </div>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Jobs registrados</p>
          <p className="mt-2 text-3xl font-bold">{AUTOMATION_JOBS.length}</p>
        </div>
        <div className="rounded-3xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Fallos recientes</p>
          <p className="mt-2 text-3xl font-bold">{failedCount}</p>
        </div>
        <div className="rounded-3xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Última ejecución</p>
          <p className="mt-2 text-sm font-semibold">
            {lastRun?.started_at ? new Date(lastRun.started_at).toLocaleString("es-ES") : "Sin ejecuciones"}
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Automatizaciones disponibles</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {AUTOMATION_JOBS.map((job) => {
            const latest = latestByJob.get(job.id);

            return (
              <article key={job.id} className="rounded-3xl border bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{job.id}</Badge>
                      <Badge variant={job.risk === "medium" ? "outline" : "secondary"}>
                        riesgo {job.risk}
                      </Badge>
                    </div>

                    <h3 className="mt-3 text-lg font-semibold">{job.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{job.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Cadencia recomendada: {job.recommendedCadence}
                    </p>

                    {latest ? (
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                        <StatusIcon status={latest.status} />
                        <Badge variant="outline" className={statusClassName(latest.status)}>
                          {latest.status}
                        </Badge>
                        <span className="text-muted-foreground">
                          {new Date(latest.started_at).toLocaleString("es-ES")}
                        </span>
                        {latest.duration_ms ? (
                          <span className="text-muted-foreground">{latest.duration_ms}ms</span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-muted-foreground">Sin ejecuciones registradas.</p>
                    )}

                    {latest?.message ? (
                      <p className="mt-2 text-xs text-muted-foreground">{latest.message}</p>
                    ) : null}
                  </div>

                  <AutomationRunButton jobId={job.id} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Últimas ejecuciones</h2>
        <div className="overflow-hidden rounded-3xl border bg-card">
          <div className="grid grid-cols-[1.1fr_0.8fr_0.7fr_0.8fr] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground">
            <span>Job</span>
            <span>Estado</span>
            <span>Trigger</span>
            <span>Inicio</span>
          </div>

          {(runs || []).map((run: any) => (
            <div key={run.id} className="grid grid-cols-[1.1fr_0.8fr_0.7fr_0.8fr] gap-3 border-b px-4 py-3 text-sm last:border-b-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{run.job_name}</p>
                <p className="truncate text-xs text-muted-foreground">{run.message || run.error || run.job_id}</p>
              </div>

              <div className="flex items-center gap-2">
                <StatusIcon status={run.status} />
                <span className="text-xs">{run.status}</span>
              </div>

              <span className="text-xs text-muted-foreground">{run.trigger_source}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(run.started_at).toLocaleString("es-ES")}
              </span>
            </div>
          ))}

          {(runs || []).length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aún no hay ejecuciones. Ejecuta la rutina diaria para iniciar el historial.
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border bg-muted/40 p-6">
        <h2 className="font-semibold">Cron recomendado en Vercel</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Programa una llamada diaria a esta URL usando tu secreto real:
        </p>
        <code className="mt-3 block overflow-x-auto rounded-2xl bg-background p-3 text-xs">
          https://www.wetudy.com/api/cron/daily?secret=TU_LAUNCH_HEALTH_SECRET
        </code>
      </section>
    </div>
  );
}
