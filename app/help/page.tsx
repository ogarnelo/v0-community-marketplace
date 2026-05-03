import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HelpContactForm } from "@/components/help/help-contact-form";
import {
  AlertTriangle,
  BookOpen,
  CreditCard,
  Gift,
  HelpCircle,
  MessageCircle,
  Store,
  Upload,
} from "lucide-react";

export const metadata = {
  title: "Centro de ayuda | Wetudy",
  description: "Ayuda para comprar, vender, donar y resolver incidencias en Wetudy.",
};

const sections = [
  {
    icon: BookOpen,
    title: "Comprar",
    items: [
      "Busca por categoría, curso, ISBN o palabra clave.",
      "Revisa fotos, estado, precio y perfil del vendedor.",
      "Pregunta por chat antes de comprar si tienes dudas.",
      "Evita pagar fuera de Wetudy si quieres más trazabilidad.",
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
      "No necesitas que un colegio gestione la donación.",
    ],
  },
  {
    icon: CreditCard,
    title: "Pagos y protección",
    items: [
      "Cuando pagas dentro de Wetudy, la operación queda vinculada.",
      "La protección depende de que anuncio, chat y pago estén registrados.",
      "Si algo falla, abre una incidencia desde la operación.",
      "Las comisiones visibles se muestran antes de confirmar.",
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
          <div className="mx-auto max-w-4xl px-4 py-16 text-center lg:px-8">
            <HelpCircle className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">
              Ayuda para comprar, vender y donar en Wetudy
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Guía rápida para reutilizar material educativo con más claridad y confianza.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <Card key={section.title}>
                <CardContent className="p-6">
                  <section.icon className="h-7 w-7 text-primary" />
                  <h2 className="mt-4 text-lg font-semibold">{section.title}</h2>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {section.items.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardContent className="p-6">
                <MessageCircle className="h-7 w-7 text-primary" />
                <h2 className="mt-4 text-xl font-semibold">Consejo clave</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Si quieres más seguridad, mantén anuncio, chat y pago dentro de Wetudy. Así podremos entender la operación si algo falla.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button asChild><Link href="/seguridad">Ver seguridad</Link></Button>
                  <Button asChild variant="outline"><Link href="/legal/proteccion-comprador">Protección comprador</Link></Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold">¿No encuentras lo que buscas?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Escríbenos y registraremos tu consulta en soporte.
                </p>
                <div className="mt-5">
                  <HelpContactForm
                    initialName={navbarData.userName || ""}
                    initialEmail=""
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
