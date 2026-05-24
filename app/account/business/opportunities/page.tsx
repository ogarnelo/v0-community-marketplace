import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { getDemandActivationOpportunities } from "@/lib/demand/opportunities";
import OpportunitiesList from "@/components/demand/opportunities-list";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lightbulb } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Productos demandados | Panel profesional Wetudy",
  robots: {
    index: false,
    follow: false,
  },
};

async function canUseBusinessOpportunities(userId: string) {
  const admin = createAdminClient();

  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("user_type")
      .eq("id", userId)
      .maybeSingle();

    if ((profile as any)?.user_type === "business") return true;
  } catch {
    // continue
  }

  try {
    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["super_admin", "school_admin"])
      .limit(1)
      .maybeSingle();

    return Boolean(role);
  } catch {
    return false;
  }
}

export default async function BusinessOpportunitiesPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/business/opportunities");

  const allowed = await canUseBusinessOpportunities(user.id);
  if (!allowed) redirect("/account");

  const opportunities = await getDemandActivationOpportunities(30);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-3 gap-2 px-0">
            <Link href="/account/business">
              <ArrowLeft className="h-4 w-4" />
              Volver al panel profesional
            </Link>
          </Button>

          <div className="rounded-3xl border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Lightbulb className="h-6 w-6 text-primary" />
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight">Productos demandados</h1>
                <p className="mt-2 max-w-3xl text-muted-foreground">
                  Publica productos que la gente ya está buscando. Wetudy detecta búsquedas sin resultado,
                  búsquedas guardadas y peticiones explícitas para ayudarte a decidir qué subir primero.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/marketplace/new">Publicar producto</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/account/business/onboarding">Plan de subida rápida</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <OpportunitiesList opportunities={opportunities} roleContext="business" />

        <div className="mt-8 rounded-3xl border bg-muted/40 p-6">
          <h2 className="font-semibold">Cómo aprovecharlo rápido</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• Empieza por oportunidades con prioridad urgente o alta.</li>
            <li>• Publica al menos 5 productos relacionados para cubrir variaciones de curso, talla o edición.</li>
            <li>• Usa títulos claros: producto + curso + editorial/modelo si aplica.</li>
            <li>• Si eres librería o papelería, crea packs por curso cuando veas demanda repetida.</li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
