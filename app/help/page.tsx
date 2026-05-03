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
  BookOpen,
  CreditCard,
  Gift,
  HelpCircle,
  MessageCircle,
  Package,
  Store,
  Upload,
} from "lucide-react";

export const metadata = {
  title: "Ayuda | Wetudy",
  description:
    "Centro de ayuda de Wetudy para comprar, vender, donar, pagar, publicar productos y resolver incidencias.",
};

const sections = [
  {
    icon: BookOpen,
    title: "Comprar",
    items: [
      "Busca por categoría, curso, ISBN o palabra clave.",
      "Revisa fotos, estado, precio y perfil del vendedor.",
      "Pregunta por chat antes de comprar si tienes dudas.",
      "Mantén la operación dentro de Wetudy para conservar trazabilidad.",
    ],
  },
  {
    icon: Upload,
    title: "Vender",
    items: [
      "Publica fotos claras y un título concreto.",
      "Indica curso, categoría, estado y precio realista.",
      "Responde rápido a mensajes y ofertas.",
      "Archiva o elimina anuncios que ya no estén disponibles.",
    ],
  },
  {
    icon: Gift,
    title: "Donar",
    items: [
      "Marca el producto como donación cuando no quieras venderlo.",
      "El solicitante puede pedirlo desde el anuncio.",
      "Si aceptas, acordáis la entrega en el chat.",
      "Donar ayuda a que material parado vuelva a usarse.",
    ],
  },
  {
    icon: CreditCard,
    title: "Pagos y protección",
    items: [
      "Cuando pagas dentro de Wetudy, la operación queda vinculada.",
      "Evita pagos externos si quieres más seguridad.",
      "La protección depende de que anuncio, chat y pago estén registrados.",
      "Si algo falla, abre una incidencia desde la operación.",
    ],
  },
  {
    icon: Store,
    title: "Negocios",
    items: [
      "Crea un perfil profesional para tu tienda o academia.",
      "Publica productos educativos de forma sencilla.",
      "Usa lotes o packs por curso para vender más rápido.",
      "Wetudy no exige montar una tienda online compleja.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Incidencias y reportes",
    items: [
      "Reporta anuncios sospechosos desde la ficha.",
      "Abre incidencia si una operación pagada tiene problemas.",
      "Incluye contexto y conserva la conversación en Wetudy.",
      "No compartas contraseñas ni datos sensibles por chat.",
    ],
  },
];

export default async function HelpPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />

      <main className="flex-1">
        <section className="border-b bg-card">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center lg:px-8 lg:py-24">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              Centro de ayuda
            </Badge>
            <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
              Todo lo básico para comprar, vender y donar en Wetudy
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Resolvemos las dudas más importantes para que puedas reutilizar material educativo con
              más confianza.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/marketplace">Explorar marketplace</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact">Contactar</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 lg:px-8 lg:py-20">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <Card key={section.title}>
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <section.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold">{section.title}</h2>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {section.items.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y bg-muted/40 py-14 lg:py-20">
          <div className="mx-auto max-w-5xl px-4 lg:px-8">
            <div className="rounded-[2rem] border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Consejo importante</h2>
                  <p className="mt-3 text-muted-foreground">
                    Si quieres más protección, evita cerrar acuerdos fuera de Wetudy. Cuando anuncio,
                    chat, pago y operación están conectados, es más fácil resolver cualquier problema.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button asChild>
                      <Link href="/seguridad">Ver seguridad</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/legal/proteccion-comprador">Protección comprador</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 lg:py-20">
          <div className="mx-auto max-w-4xl px-4 text-center lg:px-8">
            <HelpCircle className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-5 text-3xl font-bold tracking-tight">¿Necesitas ayuda concreta?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Para problemas con una compra o venta, abre incidencia desde la operación. Para dudas generales,
              escríbenos desde contacto.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/account/activity">Ver mi actividad</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact">Contactar con Wetudy</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
