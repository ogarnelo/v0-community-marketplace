import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  BookOpen,
  Heart,
  Leaf,
  MessageCircle,
  School,
  ShoppingBag,
  Users,
} from "lucide-react";

const features = [
  {
    icon: ShoppingBag,
    title: "Compra y vende dentro de tu centro",
    description:
      "Encuentra libros, uniformes, mochilas y material escolar dentro de una comunidad educativa de confianza.",
  },
  {
    icon: Heart,
    title: "Donaciones organizadas",
    description:
      "Facilita donaciones útiles para otras familias y da una segunda vida al material que ya no necesitas.",
  },
  {
    icon: MessageCircle,
    title: "Chat directo y seguro",
    description:
      "Habla con otras familias o estudiantes del centro y gestiona cada intercambio desde Wetudy.",
  },
  {
    icon: Leaf,
    title: "Ahorro y sostenibilidad",
    description:
      "Reduce el gasto escolar mientras fomentas la reutilización y el consumo responsable.",
  },
];

const steps = [
  {
    step: "01",
    title: "Únete a tu comunidad educativa",
    description:
      "Crea tu cuenta y entra con el código de tu centro para acceder al marketplace privado de tu comunidad.",
  },
  {
    step: "02",
    title: "Publica o encuentra material",
    description:
      "Explora anuncios reales o publica en pocos minutos aquello que ya no necesitas.",
  },
  {
    step: "03",
    title: "Habla y cierra el intercambio",
    description:
      "Contacta por chat, acuerda la entrega y completa la operación con total comodidad.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userName = "Mi cuenta";

  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null }>();

    userName = profile?.full_name?.trim() || user.email || "Mi cuenta";
  }

  const primaryCtaHref = user ? "/marketplace" : "/auth?mode=signup";
  const primaryCtaLabel = user ? "Ir al marketplace" : "Crear cuenta gratis";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar
        isLoggedIn={Boolean(user)}
        userName={userName}
        currentUserId={user?.id}
      />

      <main className="flex-1">
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
                  Marketplace escolar comunitario
                </Badge>

                <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Ahorra, reutiliza y conecta con tu comunidad educativa
                </h1>

                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  Wetudy es el espacio donde familias, estudiantes y centros educativos
                  compran, venden y donan material escolar de forma sencilla, segura y
                  sostenible.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href={primaryCtaHref}>
                    <Button size="lg" className="gap-2">
                      {primaryCtaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>

                  <Link href="/register-school">
                    <Button variant="outline" size="lg" className="gap-2">
                      <School className="h-4 w-4" />
                      Registrar centro
                    </Button>
                  </Link>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Comunidad por centro
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Material escolar reutilizado
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <Heart className="h-4 w-4 text-primary" />
                    Donaciones útiles
                  </div>
                </div>
              </div>

              <div>
                <Card className="overflow-hidden border-border shadow-sm">
                  <CardContent className="p-0">
                    <div className="grid gap-0 sm:grid-cols-2">
                      <div className="border-b border-border bg-primary/5 p-6 sm:border-b-0 sm:border-r">
                        <p className="text-sm font-medium text-primary">Para familias</p>
                        <h3 className="mt-2 text-xl font-semibold text-foreground">
                          Menos gasto escolar
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          Encuentra productos en buen estado, vende lo que ya no usas y
                          dona cuando quieras ayudar.
                        </p>
                      </div>

                      <div className="p-6">
                        <p className="text-sm font-medium text-primary">Para centros y AMPA</p>
                        <h3 className="mt-2 text-xl font-semibold text-foreground">
                          Más comunidad e impacto
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          Activa una red real de reutilización y visibilidad para tu
                          comunidad educativa.
                        </p>
                      </div>

                      <div className="border-t border-border bg-muted/40 p-6 sm:border-r">
                        <p className="text-2xl font-bold text-foreground">Compra</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Libros, uniformes, mochilas y más
                        </p>
                      </div>

                      <div className="border-t border-border bg-muted/40 p-6">
                        <p className="text-2xl font-bold text-foreground">Dona</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Da una segunda vida a cada artículo
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Todo lo que necesitas para mover material escolar con facilidad
              </h2>
              <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                Wetudy combina ahorro, sostenibilidad y comunidad en una experiencia
                simple y pensada para centros educativos reales.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <Card key={feature.title} className="border-border">
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/50 py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-4 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Cómo funciona
              </h2>
              <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                Empieza a usar Wetudy en pocos pasos y dentro de tu propia comunidad
                educativa.
              </p>
            </div>

            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {steps.map((item) => (
                <div key={item.step} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                    {item.step}
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-4 text-center lg:px-8">
            <h2 className="text-balance text-2xl font-bold text-foreground sm:text-3xl">
              ¿Tu centro todavía no forma parte de Wetudy?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Solicita el alta de tu colegio, instituto, universidad o academia para
              activar vuestra comunidad educativa dentro de la plataforma.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register-school">
                <Button size="lg">Solicitar alta de centro</Button>
              </Link>
              <Link href="/about">
                <Button variant="outline" size="lg">
                  Saber más
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}