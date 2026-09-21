import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { IllegalContentNoticeForm } from "@/components/legal/illegal-content-notice-form";

export const metadata: Metadata = {
  title: "Notificar contenido presuntamente ilícito",
  description:
    "Canal electrónico de Wetudy para notificar contenido concreto que pueda ser ilícito.",
  robots: { index: false, follow: true },
};

export default async function IllegalContentNoticePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const params = await searchParams;
  const initialContentUrl =
    typeof params?.url === "string" ? params.url.slice(0, 1000) : "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-8">
        <Button asChild variant="ghost" className="-ml-3 mb-6">
          <Link href="/">Volver a Wetudy</Link>
        </Button>

        <h1 className="text-3xl font-bold tracking-tight">
          Notificar contenido presuntamente ilícito
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Utiliza este canal para señalar un contenido concreto alojado en
          Wetudy que consideres contrario a la ley. Para dudas, incidencias entre
          usuarios o consultas generales utiliza el{" "}
          <Link className="font-medium text-primary hover:underline" href="/help">
            centro de ayuda
          </Link>
          .
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">
          <p>
            La notificación debe permitir localizar el contenido y explicar de
            forma suficientemente precisa por qué lo consideras ilícito. El
            envío de una notificación no implica por sí mismo que Wetudy
            comparta esa valoración: se revisará la información antes de adoptar
            las medidas que correspondan.
          </p>
        </div>

        <div className="mt-8">
          <IllegalContentNoticeForm initialContentUrl={initialContentUrl} />
        </div>

        <p className="mt-8 text-xs leading-5 text-muted-foreground">
          Los datos de este formulario se tratarán para tramitar la
          notificación, proteger la comunidad y cumplir las obligaciones legales
          aplicables. Consulta la{" "}
          <Link className="underline hover:text-foreground" href="/privacy">
            Política de privacidad
          </Link>
          .
        </p>
      </main>
      <Footer />
    </div>
  );
}
