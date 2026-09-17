import Link from "next/link";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { createPublicMetadata } from "@/lib/seo/site";

export const metadata = createPublicMetadata({
  title: "Términos de uso",
  description:
    "Reglas básicas de uso de Wetudy para publicar, contactar, acordar, valorar y reportar material escolar entre usuarios.",
  path: "/terms",
});

export default async function TermsPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
          <p className="text-sm font-semibold text-primary">Condiciones del servicio</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Términos de uso de Wetudy</h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Wetudy facilita que las personas publiquen, encuentren y comenten material
            escolar. Estas reglas describen el funcionamiento básico del servicio actual.
          </p>

          <div className="mt-8 space-y-8 leading-relaxed text-foreground/90">
            <section>
              <h2 className="text-xl font-bold">Cuenta y contenido</h2>
              <p className="mt-2">
                Cada usuario es responsable de mantener segura su cuenta y de que la
                información que publica sea razonablemente completa, veraz y respetuosa con
                otras personas. No publiques material ilegal, fraudulento, peligroso o que
                infrinja derechos de terceros.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">Anuncios y estado del material</h2>
              <p className="mt-2">
                Las fotografías y descripciones deben reflejar el artículo ofrecido. Si hay
                desgaste, anotaciones, piezas ausentes o cualquier circunstancia relevante,
                indícalo para que la otra parte pueda decidir con información suficiente.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">Contacto y acuerdos</h2>
              <p className="mt-2">
                Wetudy proporciona chat e historial para facilitar el contacto. La entrega y
                el pago se acuerdan directamente entre las partes. El servicio actual no
                procesa el pago ni contrata el transporte del artículo.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">Confirmación, valoraciones y reportes</h2>
              <p className="mt-2">
                Cuando ambas partes confirman un acuerdo, pueden valorar la experiencia.
                Utiliza los reportes para señalar contenido o comportamientos que deban
                revisarse. Las valoraciones y reportes no deben utilizarse para acosar,
                suplantar o difamar a otras personas.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">Moderación</h2>
              <p className="mt-2">
                Wetudy puede revisar, limitar o retirar contenido y restringir cuentas cuando
                sea necesario para la seguridad del servicio, el cumplimiento de estas reglas
                o la investigación de abuso.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">Centros educativos</h2>
              <p className="mt-2">
                Solicitar el alta de un centro no lo hace público automáticamente. Las nuevas
                solicitudes se revisan antes de su aprobación. La vinculación con un centro
                sirve como referencia comunitaria y de filtros dentro de Wetudy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">Ayuda</h2>
              <p className="mt-2">
                Para consultas sobre el uso del servicio, visita el{" "}
                <Link href="/help" className="font-medium text-primary hover:underline">
                  Centro de ayuda
                </Link>
                .
              </p>
            </section>
          </div>

          <p className="mt-10 text-sm text-muted-foreground">Última actualización: 18 de septiembre de 2026.</p>
        </article>
      </main>
      <Footer />
    </div>
  );
}
