import Link from "next/link";
import JsonLd from "@/components/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { buildBreadcrumbJsonLd } from "@/lib/seo/structured-data";
import { BookOpen, Camera, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";

export const metadata = buildPublicMetadata({
  title: "Vender o donar libros de texto usados",
  description: "Publica libros de texto de segunda mano con fotos, curso, editorial e ISBN para que otras familias encuentren justo lo que necesitan.",
  path: "/vende-tus-libros",
});

const steps = [
  { title: "Sube fotos", text: "La primera foto ayuda a que otras familias reconozcan rápido el libro.", icon: Camera },
  { title: "Añade datos escolares", text: "Incluye curso, asignatura, editorial e ISBN cuando lo tengas a mano.", icon: BookOpen },
  { title: "Recibe mensajes", text: "Usa el chat para resolver dudas y acordar los detalles directamente.", icon: MessageCircle },
];

export default async function SellYourBooksPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Wetudy", path: "/" },
    { name: "Vender o donar libros usados", path: "/vende-tus-libros" },
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JsonLd data={breadcrumbJsonLd} />
      <Navbar {...navbarData} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 lg:px-8">
      <section className="rounded-3xl bg-gradient-to-br from-primary/10 via-background to-muted/40 p-6 sm:p-10">
        <p className="text-sm font-semibold text-primary">Libros de texto usados</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
          Vende o dona los libros del curso pasado
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Wetudy está pensado para material escolar: publica con fotos, curso, asignatura, editorial e ISBN para que otras familias encuentren justo lo que necesitan.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg"><Link href="/marketplace/new">Publicar anuncio</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/marketplace">Buscar libros</Link></Button>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.title}>
              <CardContent className="p-6">
                <Icon className="h-6 w-6 text-primary" />
                <h2 className="mt-4 text-lg font-semibold">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="mt-8 rounded-3xl border bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">¿No encuentras un ISBN?</h2>
            <p className="mt-2 text-muted-foreground">Busca igualmente por título, editorial, asignatura o curso. Wetudy registra la demanda para entender qué material falta.</p>
          </div>
          <Search className="hidden h-12 w-12 text-primary sm:block" />
        </div>
      </section>
      </main>
      <Footer />
    </div>
  );
}
