import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  Recycle,
  Users,
  BarChart3,
  ShoppingBag,
  ArrowRight,
  Handshake,
  School,
} from "lucide-react";

const missionValues = [
  {
    icon: Heart,
    title: "Accesibilidad",
    description:
      "Reducimos la barrera economica del material escolar para que ninguna familia tenga que elegir entre educar a sus hijos y llegar a fin de mes.",
  },
  {
    icon: Recycle,
    title: "Sostenibilidad",
    description:
      "Alargamos la vida util de cada libro, mochila y uniforme. Cada reutilizacion es un paso hacia un planeta mas limpio.",
  },
  {
    icon: Users,
    title: "Comunidad",
    description:
      "Conectamos familias del mismo centro educativo para que el material pase de mano en mano dentro de una red de confianza.",
  },
  {
    icon: Handshake,
    title: "Donaciones estructuradas",
    description:
      "Las donaciones llegan a quien mas las necesita gracias a la coordinacion del AMPA y los administradores del centro.",
  },
];

const howSteps = [
  {
    step: "01",
    title: "Registrate con tu centro",
    description:
      "Crea una cuenta gratuita e introduce el codigo de tu centro educativo para unirte a tu comunidad.",
  },
  {
    step: "02",
    title: "Publica o busca material",
    description:
      "Publica lo que ya no necesitas o encuentra lo que buscas. Libros, uniformes, mochilas y mucho mas.",
  },
  {
    step: "03",
    title: "Conecta y acuerda",
    description:
      "Chatea con vendedores o compradores de tu centro y acordad el intercambio de forma segura.",
  },
  {
    step: "04",
    title: "Mide tu impacto",
    description:
      "Cada transaccion se refleja en las metricas de impacto de tu centro: ahorro, reutilizacion y sostenibilidad.",
  },
];

export default async function AboutPage() {
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar
        isLoggedIn={Boolean(user)}
        userName={userName}
        currentUserId={user?.id}
      />
      <main className="flex-1">
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center lg:px-8 lg:py-24">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              Sobre Wetudy
            </Badge>
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              El marketplace escolar que une familias y cuida el planeta
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Wetudy nace con una mision clara: que ningun material escolar en buen
              estado acabe en la basura y que todas las familias puedan acceder a lo
              que sus hijos necesitan sin renunciar a la calidad.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/auth?mode=signup">
                <Button size="lg" className="gap-2">
                  Unete ahora <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="outline" size="lg" className="gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Explorar marketplace
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Nuestra mision
              </h2>
              <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                Creemos que la educacion es un derecho y la sostenibilidad una
                responsabilidad. Wetudy combina ambas cosas.
              </p>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {missionValues.map((val) => (
                <Card key={val.title} className="border-border">
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <val.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-foreground">
                      {val.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {val.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/50 py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-4 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Como funciona
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                En cuatro pasos sencillos empiezas a ahorrar y a contribuir.
              </p>
            </div>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {howSteps.map((s) => (
                <div key={s.step} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {s.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-4 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Medicion de impacto
              </h2>
              <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted-foreground">
                Cada transaccion en Wetudy genera datos de impacto real que compartimos
                con centros, familias y administraciones.
              </p>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              <Card className="border-border text-center">
                <CardContent className="p-6">
                  <BarChart3 className="mx-auto h-8 w-8 text-primary" />
                  <h3 className="mt-3 font-semibold text-foreground">Panel por centro</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Cada colegio tiene metricas propias: articulos reutilizados,
                    familias activas y ahorro generado.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border text-center">
                <CardContent className="p-6">
                  <School className="mx-auto h-8 w-8 text-primary" />
                  <h3 className="mt-3 font-semibold text-foreground">Ranking publico</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Los centros mas activos aparecen en nuestro ranking, motivando la
                    participacion de toda la comunidad.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border text-center">
                <CardContent className="p-6">
                  <Recycle className="mx-auto h-8 w-8 text-secondary" />
                  <h3 className="mt-3 font-semibold text-foreground">Huella ambiental</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Calculamos el CO2 evitado por cada reutilizacion, contribuyendo a
                    los ODS de Naciones Unidas.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-primary/5 py-16 lg:py-20">
          <div className="mx-auto max-w-2xl px-4 text-center lg:px-8">
            <h2 className="text-balance text-2xl font-bold text-foreground sm:text-3xl">
              Forma parte del cambio
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Unete a miles de familias que ya ahorran, reutilizan y ayudan a otras
              familias de su comunidad educativa.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/auth?mode=signup">
                <Button size="lg">Crear cuenta gratis</Button>
              </Link>
              <Link href="/ranking">
                <Button variant="outline" size="lg">
                  Ver ranking de centros
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
