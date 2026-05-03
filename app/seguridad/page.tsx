import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CreditCard,
  MessageCircle,
  ShieldCheck,
  Star,
  UserCheck,
} from "lucide-react";

export const metadata = {
  title: "Seguridad y confianza | Wetudy",
  description:
    "Compra y vende material educativo con chat, pagos vinculados, reputación e incidencias dentro de Wetudy.",
};

const trustItems = [
  {
    icon: MessageCircle,
    title: "Chat vinculado al anuncio",
    text: "Las dudas, ofertas y acuerdos quedan asociados a la operación, no perdidos en conversaciones externas.",
  },
  {
    icon: CreditCard,
    title: "Pago dentro de Wetudy",
    text: "Cuando pagas dentro de la plataforma, la operación queda registrada y puede tener seguimiento.",
  },
  {
    icon: Star,
    title: "Reputación visible",
    text: "Las valoraciones y la actividad ayudan a elegir mejor con quién comprar, vender o donar.",
  },
  {
    icon: AlertTriangle,
    title: "Incidencias postventa",
    text: "Si algo falla, puedes abrir una incidencia desde la operación para mantener el contexto.",
  },
  {
    icon: UserCheck,
    title: "Perfiles con contexto",
    text: "Familias, estudiantes y negocios locales pueden mostrar actividad, anuncios y reputación.",
  },
  {
    icon: ShieldCheck,
    title: "Mejor que acordarlo fuera",
    text: "Fuera de Wetudy no podemos ver anuncio, chat, pago ni estado de la operación.",
  },
];

export default async function SeguridadPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />

      <main className="flex-1">
        <section className="border-b bg-card">
          <div className="mx-auto max-w-5xl px-4 py-16 text-center lg:px-8 lg:py-24">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              Confianza Wetudy
            </Badge>
            <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
              Compra y vende material educativo con más contexto y confianza
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Wetudy conecta anuncio, chat, ofertas, pagos, reputación e incidencias para que las
              operaciones sean más claras que en grupos de WhatsApp o acuerdos improvisados.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/marketplace">Explorar marketplace</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/legal/proteccion-comprador">Ver protección comprador</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 lg:px-8 lg:py-20">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {trustItems.map((item) => (
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
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold">Qué cubre mejor Wetudy</h2>
                  <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                    <li>• Operaciones iniciadas desde un anuncio de Wetudy.</li>
                    <li>• Conversaciones mantenidas dentro del chat de la plataforma.</li>
                    <li>• Pagos realizados dentro de Wetudy cuando estén disponibles.</li>
                    <li>• Incidencias abiertas desde la operación vinculada.</li>
                    <li>• Valoraciones posteriores para construir reputación.</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold">Qué no podemos proteger igual</h2>
                  <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                    <li>• Pagos realizados por fuera de la plataforma.</li>
                    <li>• Acuerdos cerrados fuera del chat de Wetudy.</li>
                    <li>• Entregas sin evidencia o sin comunicación dentro de la operación.</li>
                    <li>• Productos o condiciones que no coincidan con el anuncio publicado.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8 rounded-3xl border bg-card p-6 text-center shadow-sm">
              <h2 className="text-2xl font-bold">Regla sencilla</h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Si quieres más seguridad, mantén anuncio, chat y pago dentro de Wetudy. Así podremos
                entender la operación si algo falla.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link href="/marketplace">Comprar con Wetudy</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/help">Centro de ayuda</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
