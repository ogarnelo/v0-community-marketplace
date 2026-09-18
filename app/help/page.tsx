import JsonLd from "@/components/seo/json-ld";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpContactForm } from "@/components/help/help-contact-form";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { buildBreadcrumbJsonLd } from "@/lib/seo/structured-data";
import { HelpCircle, ShoppingBag, Gift, ArrowLeft } from "lucide-react";

export const metadata = buildPublicMetadata({
  title: "Ayuda sobre compra, venta y donación de material escolar",
  description: "Respuestas sobre publicaciones, chat, acuerdos, donaciones, favoritos y seguridad en Wetudy.",
  path: "/help",
});

const marketplaceFAQs = [
  {
    q: "Como publico un anuncio de venta?",
    a: "Accede a tu cuenta y pulsa 'Publicar'. Añade título, descripción, fotos, categoría, estado y, si es una venta, el precio orientativo. El anuncio disponible podrá encontrarse en Wetudy según los filtros de búsqueda.",
  },
  {
    q: "Como funciona el sistema de favoritos?",
    a: "Puedes guardar anuncios que te interesen haciendo clic en el icono de corazon en la tarjeta del producto. Los favoritos se guardan en tu cuenta para que puedas consultarlos mas tarde.",
  },
  {
    q: "Puedo chatear con el vendedor antes de comprar?",
    a: "Sí. Cada anuncio disponible permite abrir un chat privado entre las partes. Ahí podéis resolver dudas y acordar precio final, entrega y cualquier detalle del artículo.",
  },
  {
    q: "Como busco articulos cerca de mi?",
    a: "Puedes usar el filtro de distancia y tu código postal para ordenar anuncios por proximidad aproximada. Wetudy no publica tu ubicación exacta.",
  },
  {
    q: "Que hago si un articulo no coincide con la descripcion?",
    a: "Contacta directamente con el vendedor a traves del chat. Si no llegais a un acuerdo, puedes reportar el anuncio usando el boton de reportar en la pagina del producto. Nuestro equipo revisara el caso.",
  },
];

const donationFAQs = [
  {
    q: "¿Cómo funciona una donación?",
    a: "El anuncio se publica como donación. La persona interesada contacta por chat y ambas partes acuerdan directamente la entrega. Cuando el acuerdo se confirma, queda historial en Wetudy.",
  },
  {
    q: "¿Wetudy decide quién recibe una donación?",
    a: "No. En el MVP Wetudy facilita la publicación, el contacto y el historial, pero no asigna beneficiarios ni decide a quién debe entregarse un artículo.",
  },
  {
    q: "¿Puedo donar material a una familia de otro centro?",
    a: "Sí. El centro puede servir como referencia de confianza, pero la búsqueda también puede hacerse por zona o proximidad, según los filtros disponibles.",
  },
  {
    q: "¿Qué material puedo donar?",
    a: "Libros, uniformes, mochilas y otros materiales escolares que puedan seguir utilizándose. Describe el estado con claridad y añade fotos reales del artículo.",
  },
]

export default async function HelpPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navbarProps = await getNavbarData(supabase);

  const initialName = navbarProps.userName || "";
  const initialEmail = user?.email || "";
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Wetudy", path: "/" },
    { name: "Ayuda", path: "/help" },
  ]);
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [...marketplaceFAQs, ...donationFAQs].map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JsonLd data={[breadcrumbJsonLd, faqJsonLd]} />
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
