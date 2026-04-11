import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpContactForm } from "@/components/help/help-contact-form";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { HelpCircle, ShoppingBag, Gift, ArrowLeft } from "lucide-react";

const marketplaceFAQs = [
  {
    q: "Como publico un anuncio de venta?",
    a: "Accede a tu cuenta, haz clic en 'Publicar anuncio' desde el marketplace o la barra de navegacion. Rellena el formulario con titulo, descripcion, fotos, categoria, estado y precio. Tu anuncio sera visible inmediatamente para los miembros de tu centro.",
  },
  {
    q: "Como funciona el sistema de favoritos?",
    a: "Puedes guardar anuncios que te interesen haciendo clic en el icono de corazon en la tarjeta del producto. Los favoritos se guardan en tu cuenta para que puedas consultarlos mas tarde.",
  },
  {
    q: "Puedo chatear con el vendedor antes de comprar?",
    a: "Si, cada anuncio tiene un boton 'Contactar vendedor' que abre un chat privado entre comprador y vendedor. Ahi podeis acordar precio, punto de encuentro y cualquier detalle sobre el articulo.",
  },
  {
    q: "Como busco articulos cerca de mi?",
    a: "Activa el modo 'Cerca de mi' en el marketplace. Esto amplia la busqueda a centros de tu zona, mostrando la distancia en kilometros a cada anuncio.",
  },
  {
    q: "Que hago si un articulo no coincide con la descripcion?",
    a: "Contacta directamente con el vendedor a traves del chat. Si no llegais a un acuerdo, puedes reportar el anuncio usando el boton de reportar en la pagina del producto. Nuestro equipo revisara el caso.",
  },
];

const donationFAQs = [
  {
    q: "Como funcionan las solicitudes de donacion?",
    a: "Cuando un usuario publica un articulo como donacion, otros miembros del centro pueden solicitar recibirlo. El administrador del centro (AMPA) revisa las solicitudes y decide a quien asignar el articulo, priorizando las familias con mayor necesidad.",
  },
  {
    q: "Quien aprueba las solicitudes de donacion?",
    a: "El administrador del centro educativo o el representante del AMPA revisa y aprueba cada solicitud. Esto garantiza que las donaciones lleguen a quien mas las necesita de forma justa y transparente.",
  },
  {
    q: "Puedo donar material aunque no sea de mi centro?",
    a: "Si, puedes publicar una donacion y esta sera visible para los miembros de tu centro. Si activas el modo 'Cerca de mi', tambien podra ser vista por familias de centros cercanos.",
  },
  {
    q: "Que tipo de material se puede donar?",
    a: "Se puede donar cualquier material escolar en buen estado: libros de texto, uniformes, mochilas, material de escritura, instrumentos musicales, calculadoras, etc. Solo pedimos que el articulo este en condiciones de ser utilizado.",
  },
];

type SafeUserMetadata = {
  full_name?: string;
  user_type?: string;
};

export default async function HelpPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navbarProps = await getNavbarData(supabase);

  let initialName = navbarProps.userName || "";
  let initialEmail = user?.email || "";

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