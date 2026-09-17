import Link from "next/link";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { createPublicMetadata } from "@/lib/seo/site";

export const metadata = createPublicMetadata({
  title: "Privacidad",
  description:
    "Información sobre los datos que Wetudy utiliza para cuentas, anuncios, chat, acuerdos, soporte, seguridad y funcionamiento de la plataforma.",
  path: "/privacy",
});

export default async function PrivacyPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
          <p className="text-sm font-semibold text-primary">Información de privacidad</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Privacidad en Wetudy</h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Esta página resume cómo se utilizan los datos necesarios para prestar y proteger
            Wetudy. No sustituye el asesoramiento legal que pueda requerir la plataforma a
            medida que crezca o cambie su operativa.
          </p>

          <div className="mt-8 space-y-8 leading-relaxed text-foreground/90">
            <section>
              <h2 className="text-xl font-bold">Datos que utiliza la plataforma</h2>
              <p className="mt-2">
                Wetudy puede tratar datos de cuenta y perfil, centro educativo y zona
                aproximada, anuncios y fotografías, favoritos y búsquedas guardadas,
                conversaciones, acuerdos, valoraciones, reportes y consultas de soporte.
                También se generan datos técnicos necesarios para seguridad, prevención de
                abuso, diagnóstico y funcionamiento del servicio.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">Para qué se utilizan</h2>
              <p className="mt-2">
                Los datos se utilizan para autenticar cuentas, mostrar y buscar material,
                facilitar el contacto entre las partes, conservar el historial de acuerdos,
                enviar avisos relacionados con la actividad, moderar contenido, responder a
                soporte y proteger la plataforma frente a fraude o abuso.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">Ubicación y proximidad</h2>
              <p className="mt-2">
                Wetudy trabaja con referencias aproximadas como el código postal para
                calcular proximidad. La dirección exacta de una persona no se publica como
                parte del anuncio por este mecanismo.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">Proveedores técnicos</h2>
              <p className="mt-2">
                Para operar el servicio se utilizan proveedores de infraestructura,
                base de datos y autenticación, correo transaccional, analítica técnica y
                protección antiabuso. El acceso de estos proveedores se limita a las
                funciones técnicas necesarias para prestar sus servicios.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">Conservación y seguridad</h2>
              <p className="mt-2">
                Los datos se conservan mientras sean necesarios para la cuenta, el servicio,
                la seguridad, la moderación y las obligaciones aplicables. Wetudy aplica
                controles de acceso y permisos por usuario y rol, y revisa de forma continua
                la exposición de datos y eventos sensibles.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">Consultas sobre tus datos</h2>
              <p className="mt-2">
                Si necesitas consultar, corregir o plantear una solicitud relacionada con
                tus datos, utiliza el{" "}
                <Link href="/help" className="font-medium text-primary hover:underline">
                  Centro de ayuda
                </Link>
                . La identidad legal y los canales formales adicionales se incorporarán a la
                documentación correspondiente antes de ampliar el servicio más allá del
                alcance actual.
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
