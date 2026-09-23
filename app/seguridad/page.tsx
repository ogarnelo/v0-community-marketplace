import Link from "next/link";
import JsonLd from "@/components/seo/json-ld";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { buildBreadcrumbJsonLd } from "@/lib/seo/structured-data";
import {
  AlertTriangle,
  CheckCircle2,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";

export const metadata = buildPublicMetadata({
  title: "Seguridad al comprar, vender y donar material escolar",
  description:
    "Consejos para usar Wetudy con seguridad: protege tu cuenta, revisa los anuncios, conversa por chat y reporta incidencias cuando sea necesario.",
  path: "/seguridad",
});

const safetyItems = [
  {
    icon: LockKeyhole,
    title: "Protege tu cuenta",
    text: "Usa una contraseña que no reutilices en otros servicios y no compartas enlaces de acceso, códigos de verificación ni credenciales con otras personas.",
  },
  {
    icon: MessageCircle,
    title: "Mantén el contexto en el chat",
    text: "Utiliza el chat de Wetudy para resolver dudas y dejar constancia de los detalles importantes del acuerdo antes de la entrega.",
  },
  {
    icon: ShoppingBag,
    title: "Revisa el artículo y las condiciones",
    text: "Comprueba fotos, descripción, estado, precio y cualquier detalle relevante. Si algo no está claro, pregúntalo antes de confirmar el acuerdo.",
  },
  {
    icon: ShieldCheck,
    title: "Acuerda entrega y pago directamente",
    text: "En el flujo público actual, Wetudy facilita el contacto y el historial del acuerdo. La entrega y el pago se acuerdan directamente entre las partes.",
  },
];

export default async function SecurityPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Wetudy", path: "/" },
    { name: "Seguridad", path: "/seguridad" },
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JsonLd data={breadcrumbJsonLd} />
      <Navbar {...navbarData} />

      <main className="flex-1">
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-4xl px-4 py-14 text-center lg:px-8 lg:py-20">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Seguridad al usar Wetudy
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Recomendaciones prácticas para comprar, vender o donar material escolar con información clara y un historial de conversación útil.
            </p>
          </div>
        </section>

        <section className="py-12 lg:py-16">
          <div className="mx-auto max-w-5xl px-4 lg:px-8">
            <div className="grid gap-5 md:grid-cols-2">
              {safetyItems.map((item) => (
                <Card key={item.title} className="border-border">
                  <CardContent className="p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <Card className="border-amber-200 bg-amber-50/60">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    <div>
                      <h2 className="font-semibold text-amber-950">Si algo no encaja</h2>
                      <p className="mt-2 text-sm leading-6 text-amber-900">
                        No confirmes un acuerdo si la información ha cambiado o no coincide con lo hablado. Puedes seguir preguntando por chat y utilizar las opciones de reporte disponibles cuando exista un problema.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-emerald-200 bg-emerald-50/60">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    <div>
                      <h2 className="font-semibold text-emerald-950">Necesitas ayuda</h2>
                      <p className="mt-2 text-sm leading-6 text-emerald-900">
                        El Centro de ayuda explica cómo funcionan anuncios, chat, acuerdos, donaciones, centros y reportes.
                      </p>
                      <Button asChild variant="outline" className="mt-4">
                        <Link href="/help">Ir al Centro de ayuda</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
