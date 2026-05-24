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
import { CheckCircle2, PackagePlus, Store } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Plan de subida rápida | Wetudy negocios",
  robots: {
    index: false,
    follow: false,
  },
};

async function canAccess(userId: string) {
  const admin = createAdminClient();

  const [{ data: profile }, { data: role }] = await Promise.all([
    admin.from("profiles").select("user_type").eq("id", userId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId).in("role", ["super_admin", "school_admin"]).limit(1).maybeSingle(),
  ]);

  return (profile as any)?.user_type === "business" || Boolean(role);
}

export default async function BusinessOnboardingPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/business/onboarding");
  if (!(await canAccess(user.id))) redirect("/account");

  const opportunities = await getDemandActivationOpportunities(10);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">
        <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
          <Store className="h-8 w-8 text-primary" />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Plan de subida rápida</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Para ganar ventas rápido, no subas productos al azar. Empieza por los productos que Wetudy ya detecta como demandados.
          </p>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border bg-card p-5">
            <CheckCircle2 className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-semibold">1. Publica 10 productos</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Prioriza los productos de la lista. Son señales con intención real.
            </p>
          </div>
          <div className="rounded-3xl border bg-card p-5">
            <PackagePlus className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-semibold">2. Crea variaciones</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Curso, talla, editorial, edición, color o modelo pueden multiplicar coincidencias.
            </p>
          </div>
          <div className="rounded-3xl border bg-card p-5">
            <CheckCircle2 className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-semibold">3. Responde rápido</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Los primeros chats y ofertas son clave para activar confianza y ranking.
            </p>
          </div>
        </section>

        <OpportunitiesList
          opportunities={opportunities}
          roleContext="business_onboarding"
          compact
          emptyTitle="Aún no hay señales suficientes"
          emptyText="Mientras recogemos demanda, publica tus productos más vendidos o packs por curso."
        />

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/marketplace/new">Publicar producto</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/account/business/opportunities">Ver todas las oportunidades</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
