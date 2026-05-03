import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  BookOpen,
  Euro,
  Gift,
  GraduationCap,
  MessageCircle,
  Recycle,
  Search,
  ShieldCheck,
  Store,
  Upload,
} from "lucide-react";

export const metadata = {
  title: "Wetudy | Ahorra en material educativo reutilizado",
  description:
    "Compra, vende y dona libros, uniformes, calculadoras y material escolar entre familias, estudiantes y negocios locales.",
};

const pillars = [
  {
    icon: Euro,
    title: "Ahorro para familias",
    text: "Compra material educativo más barato y recupera parte del gasto vendiendo lo que ya no usas.",
  },
  {
    icon: Recycle,
    title: "Más vida útil",
    text: "Los libros, uniformes y calculadoras pueden seguir ayudando mucho después de un curso.",
  },
  {
    icon: Gift,
    title: "Donaciones fáciles",
    text: "Dale salida a material que todavía sirve y puede ayudar a otra familia o estudiante.",
  },
  {
    icon: Store,
    title: "Negocios locales",
    text: "Librerías, papelerías y academias pueden publicar productos y packs sin montar una tienda online.",
  },
];

const steps = [
  {
    icon: Search,
    title: "Encuentra",
    text: "Busca por categoría, curso, ISBN o necesidad: libros, uniformes, calculadoras, apuntes y más.",
  },
  {
    icon: MessageCircle,
    title: "Habla y negocia",
    text: "Usa el chat para resolver dudas, hacer ofertas o acordar una donación.",
  },
  {
    icon: ShieldCheck,
    title: "Compra con más confianza",
    text: "Cuando pagas dentro de Wetudy, anuncio, chat, operación e incidencia quedan conectados.",
  },
  {
    icon: Upload,
    title: "Publica en minutos",
    text: "Sube fotos, precio y categoría. Lo que tienes guardado puede ser justo lo que otra persona necesita.",
  },
];

const categories = [
  "Libros de texto",
  "Uniformes",
  "Calculadoras",
  "Material escolar",
  "Tecnología educativa",
  "Apuntes",
  "Mochilas y estuches",
  "Packs por curso",
];

export default async function LandingPage() {
  const supabase = await createClient();
  const navbarProps = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarProps} />

      <main className="flex-1">
        <section className="overflow-hidden border-b bg-card">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
            <div className="flex flex-col justify-center">
              <Badge variant="outline" className="mb-5 w-fit border-primary/30 text-primary">
                Red de reutilización educativa
              </Badge>

              <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Ahorra en material educativo. Da una segunda vida a lo que ya no usas.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Compra, vende y dona libros, uniformes, calculadoras y material escolar entre familias,
                estudiantes y negocios locales. Antes de comprarlo nuevo, mira si ya existe en Wetudy.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="gap-2">
                  <Link href="/marketplace">
                    Explorar marketplace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="gap-2">
                  <Link href="/marketplace/new">
                    Publicar anuncio gratis
                  </Link>
                </Button>
              </div>

              <p className="mt-5 max-w-xl text-sm text-muted-foreground">
                En cada armario puede haber libros que vuelvan a ayudar. Wetudy conecta ese material
                olvidado con quien lo necesita ahora.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-secondary/10 blur-3xl" />

              <div className="relative rounded-[2rem] border bg-background p-5 shadow-xl">
                <div className="rounded-3xl bg-muted p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Operación armario educativo
                    </span>
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>

                  <div className="grid gap-3">
                    {[
                      ["Libro Matemáticas 3º ESO", "12 €", "Ahorro frente a nuevo"],
                      ["Uniforme en buen estado", "Donación", "Entrega acordada en chat"],
                      ["Calculadora científica", "18 €", "Lista para otro estudiante"],
                    ].map(([title, price, subtitle]) => (
                      <div key={title} className="rounded-2xl border bg-card p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
                          </div>
                          <span className="whitespace-nowrap rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">
                            {price}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl border p-3">
                    <p className="text-xs text-muted-foreground">Ahorra</p>
                    <p className="mt-1 text-lg font-bold">comprando</p>
                  </div>
                  <div className="rounded-2xl border p-3">
                    <p className="text-xs text-muted-foreground">Recupera</p>
                    <p className="mt-1 text-lg font-bold">vendiendo</p>
                  </div>
                  <div className="rounded-2xl border p-3">
                    <p className="text-xs text-muted-foreground">Ayuda</p>
                    <p className="mt-1 text-lg font-bold">donando</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Estudiar no debería ser más caro de lo necesario
              </h2>
              <p className="mt-4 text-muted-foreground">
                Cada curso muchas familias compran material que otras tienen guardado. Wetudy ayuda
                a que ese material circule, genere ahorro y siga teniendo utilidad.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {pillars.map((pillar) => (
                <Card key={pillar.title} className="border-border">
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                      <pillar.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{pillar.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pillar.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/40 py-14 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <Badge variant="outline" className="mb-4">
                  Cómo funciona
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight">
                  De armario olvidado a material útil en pocos pasos
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Wetudy une publicación rápida, chat, ofertas, donaciones, pagos y reputación en una
                  experiencia pensada para material educativo.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/marketplace">Ver anuncios</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/seguridad">Cómo protegemos las operaciones</Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {steps.map((step) => (
                  <Card key={step.title} className="border-border bg-card">
                    <CardContent className="p-5">
                      <step.icon className="h-6 w-6 text-primary" />
                      <h3 className="mt-3 font-semibold">{step.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div>
                <Badge variant="outline" className="mb-4">
                  Especializado en educación
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight">
                  No es un marketplace de todo. Es material educativo con contexto.
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Puedes buscar por curso, categoría, ISBN o tipo de producto. Y los negocios locales
                  pueden publicar productos y packs educativos para ampliar la oferta disponible.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <span key={category} className="rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-sm">
                    {category}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-primary py-14 text-primary-foreground lg:py-20">
          <div className="mx-auto max-w-5xl px-4 text-center lg:px-8">
            <GraduationCap className="mx-auto h-10 w-10" />
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Antes de comprarlo nuevo, mira si ya existe en Wetudy
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/85">
              Ayuda a otra familia, recupera parte del gasto escolar o dona material que todavía
              puede acompañar a otro estudiante.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link href="/marketplace">Explorar marketplace</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                <Link href="/marketplace/new">Publicar anuncio</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
