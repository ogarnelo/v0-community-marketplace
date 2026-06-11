import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SeoPageStatusActions from "@/components/seo/seo-page-status-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SEO programático controlado | Wetudy",
  robots: {
    index: false,
    follow: false,
  },
};

const FALLBACK_SUPERADMIN_EMAILS = ["oscar_garnelo@hotmail.com"];

async function canAccess(userId: string, email?: string | null) {
  const admin = createAdminClient();

  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();

  if (data?.role === "super_admin") return true;

  const envEmails = process.env.SUPERADMIN_EMAILS?.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean) || [];
  const allowed = new Set([...FALLBACK_SUPERADMIN_EMAILS, ...envEmails].map((item) => item.toLowerCase()));
  return Boolean(email && allowed.has(email.toLowerCase()));
}

function statusClassName(status: string) {
  switch (status) {
    case "published":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "draft":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "noindex":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default async function AdminSeoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");
  if (!(await canAccess(user.id, user.email))) redirect("/account");

  const admin = createAdminClient();
  const { data: pages, error } = await admin
    .from("seo_programmatic_pages")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <Button asChild variant="ghost" className="mb-4 gap-2 px-0">
        <Link href="/admin/super">
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </Link>
      </Button>

      <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">SEO programático controlado</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Automatiza páginas genéricas basadas en demanda, sin exponer búsquedas sensibles, colegios o regiones.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/api/seo/autogenerate?secret=${encodeURIComponent(process.env.LAUNCH_HEALTH_SECRET || "")}`}>
                Generar ahora
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/material">Ver índice público</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-3xl border bg-muted/40 p-5">
        <div className="flex gap-3">
          <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
          <div>
            <h2 className="font-semibold">Guardrails activos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Solo categorías seguras, sin páginas por colegio, sin región automática, drafts si no hay inventario suficiente y revisión manual disponible.
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          No se pudieron cargar páginas SEO. Aplica la migración de SEO programático.
        </div>
      ) : null}

      <div className="grid gap-4">
        {(pages || []).map((page: any) => (
          <article key={page.id} className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={statusClassName(page.status)}>
                    {page.status}
                  </Badge>
                  <Badge variant="secondary">{page.page_kind}</Badge>
                  <Badge variant="outline">listings {page.active_listing_count}</Badge>
                  <Badge variant="outline">score {page.source_opportunity_score}</Badge>
                </div>

                <h2 className="mt-3 text-lg font-semibold">{page.heading}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{page.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">/{page.slug}</p>

                {page.status === "published" ? (
                  <Link href={`/material/${page.slug}`} className="mt-3 inline-flex text-sm text-primary hover:underline">
                    Ver página pública
                  </Link>
                ) : null}
              </div>

              <SeoPageStatusActions id={page.id} currentStatus={page.status} />
            </div>
          </article>
        ))}

        {(pages || []).length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card p-8 text-center">
            <h2 className="text-xl font-semibold">Aún no hay páginas generadas</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ejecuta el generador o espera a que haya señales suficientes de demanda.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
