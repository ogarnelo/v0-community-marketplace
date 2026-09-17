import Link from "next/link";
import { ArrowRight, Handshake, Heart, Package, Users } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { createPublicMetadata } from "@/lib/seo/site";

export const revalidate = 3600;

export const metadata = createPublicMetadata({
  title: "Impacto real de la reutilización escolar",
  description:
    "Consulta señales reales de uso de Wetudy: acuerdos confirmados, donaciones y material escolar disponible, sin estimaciones inventadas.",
  path: "/impacto",
});

export default async function ImpactPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [navbarData, agreementsResult, listingsResult] = await Promise.all([
    getNavbarData(supabase),
    admin
      .from("agreements")
      .select("buyer_id, seller_id, agreement_type")
      .eq("status", "confirmed"),
    admin
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "available"),
  ]);

  if (agreementsResult.error) {
    console.error("Error cargando acuerdos para impacto:", agreementsResult.error);
  }

  if (listingsResult.error) {
    console.error("Error cargando anuncios para impacto:", listingsResult.error);
  }

  const confirmedAgreements = agreementsResult.data || [];
  const participantIds = new Set<string>();
  let confirmedDonations = 0;

  for (const agreement of confirmedAgreements) {
    if (agreement.buyer_id) participantIds.add(agreement.buyer_id);
    if (agreement.seller_id) participantIds.add(agreement.seller_id);
    if (agreement.agreement_type === "donation") confirmedDonations += 1;
  }

  const stats = [
    {
      label: "Acuerdos confirmados",
      value: confirmedAgreements.length,
      detail: "Acuerdos que ambas partes han confirmado en Wetudy.",
      icon: Handshake,
    },
    {
      label: "Personas en acuerdos",
      value: participantIds.size,
      detail: "Cuentas únicas que han participado en acuerdos confirmados.",
      icon: Users,
    },
    {
      label: "Donaciones confirmadas",
      value: confirmedDonations,
      detail: "Acuerdos de donación confirmados por sus participantes.",
      icon: Heart,
    },
    {
      label: "Anuncios disponibles",
      value: listingsResult.count || 0,
      detail: "Material que puede encontrarse actualmente en la plataforma.",
      icon: Package,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-10 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold text-primary">Impacto medido en Wetudy</p>
            <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-5xl">
              Reutilización escolar con datos reales
            </h1>
            <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Preferimos enseñar actividad registrada en la plataforma antes que publicar
              estimaciones de ahorro, CO₂ o familias beneficiadas que todavía no podamos
              demostrar con datos suficientes.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardContent className="p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="mt-5 text-3xl font-bold text-foreground">{stat.value}</p>
                    <p className="mt-1 font-semibold text-foreground">{stat.label}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {stat.detail}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <section className="mt-10 rounded-3xl border bg-card p-6 sm:p-8">
            <h2 className="text-2xl font-bold">Qué mediremos a medida que crezca la comunidad</h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
              Seguiremos acuerdos, donaciones, material reutilizado y actividad por centros.
              Solo publicaremos métricas económicas o ambientales cuando dispongamos de una
              metodología clara y datos suficientes para respaldarlas.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/marketplace">
                  Buscar material <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/como-funciona">Cómo funciona Wetudy</Link>
              </Button>
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </div>
  );
}
