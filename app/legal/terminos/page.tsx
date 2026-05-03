import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";

export const metadata = {
  title: "Términos de uso | Wetudy",
  description: "Condiciones básicas de uso del marketplace educativo Wetudy.",
};

export default async function TerminosPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-8">
        <Link href="/" className="text-sm text-primary hover:underline">← Volver</Link>
        <h1 className="mt-6 text-3xl font-bold">Términos de uso</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
          <p>
            Wetudy permite publicar, comprar, vender, donar y negociar material educativo entre familias,
            estudiantes, usuarios particulares y negocios locales.
          </p>
          <p>
            Cada usuario es responsable de la veracidad de sus anuncios, del estado de los productos publicados y del cumplimiento de los acuerdos alcanzados.
          </p>
          <p>
            Está prohibido publicar productos ilegales, falsificados, peligrosos, engañosos o ajenos al uso educativo permitido por la plataforma.
          </p>
          <p>
            La plataforma puede limitar cuentas, retirar anuncios, bloquear operaciones o cerrar accesos cuando detecte abuso, fraude, contenido prohibido o incumplimiento de normas.
          </p>
          <p>
            Los pagos, boosts, envíos o servicios asociados pueden estar sujetos a comisiones visibles antes de confirmar la operación.
          </p>
          <p>
            Wetudy facilita tecnología, trazabilidad y soporte, pero los usuarios siguen siendo responsables de sus acuerdos, entregas y comunicaciones dentro de la plataforma.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
