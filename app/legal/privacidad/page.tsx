import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";

export const metadata = {
  title: "Política de privacidad | Wetudy",
  description: "Información sobre cómo Wetudy trata datos personales para operar el marketplace educativo.",
};

export default async function PrivacidadPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-8">
        <Link href="/" className="text-sm text-primary hover:underline">← Volver</Link>
        <h1 className="mt-6 text-3xl font-bold">Política de privacidad</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
          <p>
            Wetudy trata datos personales para operar un marketplace educativo: cuenta, perfil, anuncios,
            fotografías, favoritos, búsquedas guardadas, mensajes, ofertas, pagos, envíos, soporte,
            notificaciones, incidencias y medidas de seguridad.
          </p>
          <p>
            Usamos estos datos para prestar el servicio, permitir operaciones entre usuarios, mejorar la experiencia,
            prevenir abusos, enviar comunicaciones transaccionales y cumplir obligaciones legales.
          </p>
          <p>
            Los pagos se procesan mediante proveedores externos como Stripe. Wetudy no almacena los datos completos de tarjeta.
          </p>
          <p>
            Los mensajes y operaciones pueden conservarse durante el tiempo necesario para soporte, seguridad, resolución de incidencias y cumplimiento legal.
          </p>
          <p>
            Puedes solicitar acceso, rectificación, eliminación u oposición escribiendo a soporte desde los canales indicados en la plataforma.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
