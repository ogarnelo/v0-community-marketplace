import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BadgeCheck,
  BookOpen,
  MessageCircle,
  PackagePlus,
  Store,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";

export const metadata = {
  title: "Wetudy para negocios locales",
  description:
    "Perfil profesional para librerías, papelerías, academias y tiendas educativas que quieren vender material escolar sin montar una tienda online.",
};

const benefits = [
  {
    icon: Store,
    title: "Escaparate educativo",
    text: "Muestra tu negocio, descripción, catálogo y reputación en un entorno especializado en educación.",
  },
  {
    icon: Upload,
    title: "Publicación sencilla",
    text: "Sube productos con fotos, precio, categoría, curso e ISBN sin conocimientos técnicos.",
  },
  {
    icon: PackagePlus,
    title: "Packs por curso",
    text: "Agrupa libros, cuadernos, calculadoras o material para campañas de vuelta al cole.",
  },
  {
    icon: Users,
    title: "Compradores con intención",
    text: "Llega a familias y estudiantes que ya están buscando material educativo.",
  },
  {
    icon: MessageCircle,
    title: "Chat y ofertas",
    text: "Responde dudas, negocia precios y cierra operaciones desde Wetudy.",
  },
  {
    icon: TrendingUp,
    title: "Visibilidad extra",
    text: "Destaca productos clave en momentos de alta demanda educativa.",
  },
];

const idealFor = [
  "Librerías",
  "Papelerías",
  "Tiendas de uniformes",
  "Academias",
  "Tiendas de segunda mano educativa",
  "Negocios con stock escolar",
];

export default async function NegociosPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />

      <main className="flex-1">
        <section className="border-b bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
            <div>
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
                Para librerías, papelerías, academias y tiendas
              </Badge>
              <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
                Tu escaparate educativo online, sin complicaciones
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                Publica productos, crea packs por curso y llega a familias que ya están buscando
                libros, uniformes y material escolar. No necesitas montar una tienda online completa.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/auth?mode=signup">Crear perfil profesional</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/contact">Hablar con Wetudy</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-[2rem] border bg-muted/40 p-6">
              <BadgeCheck className="h-8 w-8 text-primary" />
              <h2 className="mt-4 text-xl font-semibold">Pensado para gerentes no técnicos</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Wetudy debe ser fácil: fotos, precio, categoría y publicar. El objetivo es vender,
                no aprender software.
              </p>

              <div className="mt-6 grid gap-2">
                {idealFor.map((item) => (
                  <div key={item} className="rounded-2xl border bg-card px-4 py-3 text-sm font-medium">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Vende donde la búsqueda ya es educativa
            </h2>
            <p className="mt-4 text-muted-foreground">
              En un marketplace generalista compites con todo. En Wetudy tus productos aparecen en un
              contexto de familias y estudiantes preparando el curso.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((item) => (
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
        </section>

        <section className="border-y bg-muted/40 py-14 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <Badge variant="outline" className="mb-4">
                  Liquidez local
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight">
                  Los negocios locales pueden ser clave para que haya oferta desde el primer día
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Wetudy combina productos de familias, estudiantes y comercios. Así el marketplace
                  puede tener más variedad y disponibilidad sin perder el foco educativo.
                </p>
              </div>

              <div className="rounded-[2rem] border bg-card p-6 shadow-sm">
                <BookOpen className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-xl font-semibold">Ejemplos de productos</h3>
                <ul className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <li>• libros nuevos y usados</li>
                  <li>• packs por curso</li>
                  <li>• calculadoras</li>
                  <li>• material escolar</li>
                  <li>• uniformes</li>
                  <li>• productos de academia</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 lg:py-20">
          <div className="mx-auto max-w-4xl px-4 text-center lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight">
              Tu tienda ya tiene productos. Wetudy te ayuda a encontrar compradores.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Empieza con un perfil profesional y publica tus primeros productos educativos.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/auth?mode=signup">Crear perfil profesional</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/marketplace">Ver marketplace</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
