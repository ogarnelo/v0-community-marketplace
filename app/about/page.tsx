import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Euro, Gift, Recycle, ShieldCheck, Store, Users } from "lucide-react";

export const metadata = {
  title: "Sobre Wetudy | Reutilización educativa con impacto social",
  description: "Wetudy nace para que el material educativo circule más, ayude a las familias a ahorrar y llegue a quien lo necesita.",
};

const values = [
  { icon: Euro, title: "Ahorro digno", text: "Comprar reutilizado o vender lo que ya no usas debería ser una opción normal, práctica y accesible." },
  { icon: Recycle, title: "Más vida útil", text: "Un libro, un uniforme o una calculadora pueden acompañar a otra persona cuando termina un curso." },
  { icon: Gift, title: "Ayuda directa", text: "Las donaciones permiten que material parado llegue a familias y estudiantes que pueden darle uso real." },
  { icon: ShieldCheck, title: "Confianza", text: "Anuncio, chat, oferta, pago, incidencia y valoración quedan conectados para reducir incertidumbre." },
];

export default async function AboutPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="flex-1">
        <section className="border-b bg-card">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center lg:px-8 lg:py-24">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">Sobre Wetudy</Badge>
            <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
              El material educativo no debería quedarse parado cuando todavía puede ayudar
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Wetudy nace de una idea sencilla: en muchas casas hay libros, uniformes y material escolar guardados que otra familia necesita ahora.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg"><Link href="/marketplace">Explorar marketplace</Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/impacto">Ver impacto social</Link></Button>
            </div>
          </div>
        </section>

        <section className="py-14 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <Badge variant="outline" className="mb-4">Nuestra misión</Badge>
                <h2 className="text-3xl font-bold tracking-tight">Que estudiar no sea más caro de lo necesario</h2>
                <p className="mt-4 text-muted-foreground">
                  Queremos que el material educativo circule más, se aproveche mejor y llegue a quien lo necesita:
                  familias que quieren ahorrar, estudiantes que buscan material y negocios locales que ya tienen productos educativos.
                </p>
                <p className="mt-4 text-muted-foreground">
                  Los centros educativos pueden sumarse en el futuro, pero Wetudy empieza desde lo más sencillo:
                  personas ayudando a personas mediante compraventa, donaciones y reutilización.
                </p>
              </div>

              <div className="rounded-[2rem] border bg-card p-6 shadow-sm">
                <BookOpen className="h-9 w-9 text-primary" />
                <blockquote className="mt-5 text-2xl font-semibold leading-snug">
                  “Lo que a una familia ya no le sirve, a otra puede ahorrarle mucho dinero.”
                </blockquote>
                <p className="mt-4 text-sm text-muted-foreground">
                  Esa es la base de Wetudy: transformar armarios llenos de material olvidado en una red educativa reutilizable.
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {values.map((value) => (
                <Card key={value.title}>
                  <CardContent className="p-6">
                    <value.icon className="h-7 w-7 text-primary" />
                    <h3 className="mt-4 font-semibold">{value.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{value.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/40 py-14 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Qué hace diferente a Wetudy</h2>
              <p className="mt-4 text-muted-foreground">
                No competimos por tener de todo. Competimos por entender una necesidad concreta: material educativo con contexto.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              <Card><CardContent className="p-6"><Users className="h-7 w-7 text-primary" /><h3 className="mt-4 font-semibold">Familias y estudiantes</h3><p className="mt-2 text-sm text-muted-foreground">Compra, vende o dona material que tiene sentido para el curso, la etapa o el uso educativo.</p></CardContent></Card>
              <Card><CardContent className="p-6"><Store className="h-7 w-7 text-primary" /><h3 className="mt-4 font-semibold">Negocios locales</h3><p className="mt-2 text-sm text-muted-foreground">Librerías, papelerías y academias pueden publicar productos y packs sin montar una tienda online.</p></CardContent></Card>
              <Card><CardContent className="p-6"><Recycle className="h-7 w-7 text-primary" /><h3 className="mt-4 font-semibold">Impacto medible</h3><p className="mt-2 text-sm text-muted-foreground">A medida que crezca la comunidad, Wetudy medirá productos reutilizados, ahorro y donaciones reales.</p></CardContent></Card>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
