import Link from "next/link";
import { createPublicMetadata } from "@/lib/seo/site";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpContactForm } from "@/components/help/help-contact-form";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { HelpCircle, ShoppingBag, Gift, ArrowLeft } from "lucide-react";

export const metadata = createPublicMetadata({
  title: "Centro de ayuda",
  description:
    "Respuestas sobre publicar, buscar, contactar, acordar, donar y reportar material escolar en Wetudy.",
  path: "/help",
});

const marketplaceFAQs = [
  {
    q: "Como publico un anuncio de venta?",
    a: "Accede a tu cuenta, pulsa 'Publicar' y completa el formulario con título, descripción, fotos, categoría, estado y precio o donación. El anuncio aparecerá en la búsqueda pública de material disponible y podrás usar tu centro o tu zona como filtros de proximidad.",
  },
  {
    q: "Como funciona el sistema de favoritos?",
    a: "Puedes guardar anuncios que te interesen haciendo clic en el icono de corazon en la tarjeta del producto. Los favoritos se guardan en tu cuenta para que puedas consultarlos mas tarde.",
  },
  {
    q: "Puedo chatear con el vendedor antes de comprar?",
    a: "Sí. Cada anuncio permite abrir un chat privado con la otra parte para preguntar por el estado del artículo y acordar los detalles. La entrega y el pago se acuerdan directamente entre las partes.",
  },
  {
    q: "Como busco articulos cerca de mi?",
    a: "Usa el filtro de distancia y tu código postal aproximado para ordenar o limitar los anuncios cercanos. Wetudy utiliza esa referencia para mostrar proximidad sin publicar tu dirección exacta.",
  },
  {
    q: "Que hago si un articulo no coincide con la descripcion?",
    a: "Contacta directamente con el vendedor a traves del chat. Si no llegais a un acuerdo, puedes reportar el anuncio usando el boton de reportar en la pagina del producto. Nuestro equipo revisara el caso.",
  },
];

const donationFAQs = [
  {
    q: "¿Cómo funciona una donación?",
    a: "Publica el artículo como donación. Las personas interesadas pueden contactarte por chat y ambas partes acuerdan directamente la entrega. Cuando el acuerdo termina, podéis confirmarlo en Wetudy.",
  },
  {
    q: "¿Quién decide a quién se entrega una donación?",
    a: "En el flujo actual, la persona que publica la donación decide con quién llega a un acuerdo a través del chat. Wetudy facilita el contacto y el historial, pero no asigna automáticamente el material.",
  },
  {
    q: "¿Puedo donar material a alguien de otro centro?",
    a: "Sí. El centro puede servir como referencia de confianza y filtro, pero la búsqueda también puede abrirse por zona o distancia.",
  },
  {
    q: "¿Qué material puedo donar?",
    a: "Material escolar reutilizable y en condiciones de uso: libros, uniformes, mochilas, calculadoras y otros artículos educativos. Describe con claridad su estado y añade fotos reales.",
  },
];

export default async function HelpPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navbarProps = await getNavbarData(supabase);

  const initialName = navbarProps.userName || "";
  const initialEmail = user?.email || "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarProps} />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>

          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <HelpCircle className="h-7 w-7 text-primary" />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
              Centro de ayuda
            </h1>
            <p className="mt-2 text-muted-foreground">
              Encuentra respuestas a las preguntas mas frecuentes.
            </p>
          </div>

          <div className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Marketplace</h2>
            </div>

            <Card className="border-border">
              <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                  {marketplaceFAQs.map((faq, i) => (
                    <AccordionItem key={i} value={`mp-${i}`} className="px-5">
                      <AccordionTrigger className="text-left text-sm font-medium text-foreground">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <div className="mb-4 flex items-center gap-2">
              <Gift className="h-5 w-5 text-secondary" />
              <h2 className="text-xl font-bold text-foreground">Donaciones</h2>
            </div>

            <Card className="border-border">
              <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                  {donationFAQs.map((faq, i) => (
                    <AccordionItem key={i} value={`dn-${i}`} className="px-5">
                      <AccordionTrigger className="text-left text-sm font-medium text-foreground">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>

          <div className="mt-10">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-foreground">
                  No encuentras lo que buscas?
                </CardTitle>
                <CardDescription>
                  Escribenos y registraremos tu consulta en soporte.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <HelpContactForm
                  initialName={initialName}
                  initialEmail={initialEmail}
                  isLoggedIn={navbarProps.isLoggedIn}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
