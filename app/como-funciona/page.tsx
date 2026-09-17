import Link from "next/link";
import { CheckCircle2, MessageCircle, Search, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createPublicMetadata } from "@/lib/seo/site";

export const metadata = createPublicMetadata({
  title: "Cómo funciona",
  description:
    "Busca, publica y contacta por chat para reutilizar material escolar. La entrega y el pago se acuerdan directamente entre las partes.",
  path: "/como-funciona",
});

const buyerSteps = [
  "Busca por curso, categoría, título, editorial o ISBN.",
  "Contacta por chat para preguntar estado, disponibilidad y detalles.",
  "Acordad directamente entrega y pago, y confirmad el acuerdo para dejar historial.",
];

const sellerSteps = [
  "Publica el material con fotos reales y datos útiles.",
  "Responde por chat a familias o estudiantes interesados.",
  "Cuando lo tengáis claro, confirmad el acuerdo y valorad la experiencia.",
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:px-8">
      <section className="text-center">
        <p className="text-sm font-semibold text-primary">Cómo funciona</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Reutilizar material escolar sin complicarlo</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Wetudy facilita encontrar, publicar y contactar. La entrega y el pago se acuerdan directamente entre las partes.
        </p>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-2">
        <Card>
          <CardContent className="p-6 sm:p-8">
            <Search className="h-7 w-7 text-primary" />
            <h2 className="mt-4 text-2xl font-bold">Para buscar material</h2>
            <ol className="mt-5 space-y-4">
              {buyerSteps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 sm:p-8">
            <UploadCloud className="h-7 w-7 text-primary" />
            <h2 className="mt-4 text-2xl font-bold">Para publicar material</h2>
            <ol className="mt-5 space-y-4">
              {sellerSteps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 rounded-3xl border bg-muted/30 p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">Fotos obligatorias para publicar con más confianza.</p></div>
          <div className="flex gap-3"><MessageCircle className="h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">Chat para resolver dudas antes de acordar.</p></div>
          <div className="flex gap-3"><Search className="h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">Búsqueda por señales educativas, no por categorías genéricas.</p></div>
        </div>
      </section>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild size="lg"><Link href="/marketplace">Ir al marketplace</Link></Button>
        <Button asChild size="lg" variant="outline"><Link href="/marketplace/new">Publicar anuncio</Link></Button>
      </div>
    </main>
  );
}
