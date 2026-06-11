import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDemandActivationOpportunities, opportunityLabel, priorityClassName, priorityLabel } from "@/lib/demand/opportunities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Campañas sugeridas | Wetudy",
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

export default async function SuperCampaignsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");
  if (!(await canAccess(user.id, user.email))) redirect("/account");

  const opportunities = await getDemandActivationOpportunities(20);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <Button asChild variant="ghost" className="mb-4 gap-2 px-0">
        <Link href="/admin/super/insights">
          <ArrowLeft className="h-4 w-4" />
          Volver a insights
        </Link>
      </Button>

      <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
        <Megaphone className="h-8 w-8 text-primary" />
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Campañas sugeridas</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Ideas accionables para captar oferta, negocios locales o crear contenido SEO controlado sin exponer el mapa completo de demanda.
        </p>
      </div>

      <div className="grid gap-4">
        {opportunities.map((opportunity) => {
          const label = opportunityLabel(opportunity);
          const priority = opportunity.priority || "emerging";
          const suggestedAction =
            priority === "urgent"
              ? "Contactar negocios locales y publicar campaña de captación esta semana."
              : priority === "high"
                ? "Preparar pack o lote recomendado y contactar proveedores."
                : "Usar como contenido o sugerencia de publicación.";

          return (
            <div key={`${opportunity.demand_key}-${opportunity.grade_level}-${opportunity.region}`} className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Badge variant="outline" className={priorityClassName(priority)}>
                    {priorityLabel(priority)}
                  </Badge>
                  <h2 className="mt-3 text-xl font-semibold">{label}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{opportunity.recommendation_reason}</p>
                  <p className="mt-3 text-sm font-medium">Acción sugerida: {suggestedAction}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/contact">Contactar proveedor</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/marketplace/new?source=campaign&title=${encodeURIComponent(label)}`}>
                      Crear anuncio
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {opportunities.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card p-8 text-center">
            <h2 className="text-xl font-semibold">Aún no hay campañas sugeridas</h2>
            <p className="mt-2 text-sm text-muted-foreground">Cuando haya demanda suficiente aparecerán aquí.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
