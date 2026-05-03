import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Euro, Gift, Home, Recycle, Users } from "lucide-react";

export const metadata = {
  title: "Impacto social | Wetudy",
  description:
    "Wetudy ayuda a que libros, uniformes y material escolar tengan más vida útil y generen ahorro real para familias y estudiantes.",
};

const impactItems = [
  {
    icon: Euro,
    title: "Menos gasto para familias",
    text: "Cada producto reutilizado puede reducir el coste de preparar el curso y aliviar un gasto que se repite cada año.",
  },
  {
    icon: BookOpen,
    title: "Libros con más vida",
    text: "Muchos libros siguen en buen estado al acabar el curso. Wetudy ayuda a que vuelvan a utilizarse.",
  },
  {
    icon: Home,
    title: "Armarios con valor dormido",
    text: "Uniformes, mochilas, calculadoras y apuntes guardados pueden convertirse en ahorro o ayuda para otra persona.",
  },
  {
    icon: Gift,
    title: "Donaciones con sentido",
    text: "Donar material educativo es una forma directa de ayudar sin intermediarios ni fricción institucional.",
  },
];

export default async function ImpactoPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />

      <main className="flex-1">
        <section className="border-b bg-card">
          <div className="mx-auto max-w-5xl px-4 py-16 text-center lg:px-8 lg:py-24">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              Impacto Wetudy
            </Badge>
            <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
              Cada producto reutilizado cuenta
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Wetudy quiere ayudar a que estudiar cueste menos y a que el material educativo no se
              quede años parado cuando todavía puede servir.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/marketplace">Explorar marketplace</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/marketplace/new">Publicar material</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-14 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {impactItems.map((item) => (
                <Card key={item.title}>
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="mt-4 font-semibold">{item.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/40 py-14 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <Badge variant="outline" className="mb-4">
                  Impacto real, no cifras inventadas
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight">
                  Mediremos el ahorro y la reutilización con datos reales de la comunidad
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Cuando Wetudy empiece a acumular operaciones reales, mostraremos métricas verificables:
                  productos reutilizados, ahorro estimado, donaciones completadas y categorías con más vida útil.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Productos reutilizados", "Próximamente con datos reales"],
                  ["Ahorro estimado", "Basado en operaciones completadas"],
                  ["Donaciones completadas", "Material que llega a otra persona"],
                  ["Impacto por categoría", "Libros, uniformes, material y más"],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-2xl border bg-card p-5 shadow-sm">
                    <p className="font-semibold">{title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 lg:py-20">
          <div className="mx-auto max-w-4xl px-4 text-center lg:px-8">
            <Recycle className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-5 text-3xl font-bold tracking-tight">
              La sostenibilidad empieza aprovechando lo que ya existe
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Comprar nuevo siempre será necesario en muchos casos. Pero antes de hacerlo, Wetudy propone
              una pregunta sencilla: ¿alguien ya tiene esto y no lo está usando?
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/marketplace">Buscar material</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/about">Por qué existe Wetudy</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
