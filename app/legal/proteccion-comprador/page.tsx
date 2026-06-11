import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";

export const metadata = {
  title: "Protección del comprador | Wetudy",
  description: "Qué cubre y qué no cubre la protección del comprador en Wetudy.",
};

export default async function BuyerProtectionPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-8">
        <Link href="/seguridad" className="text-sm text-primary hover:underline">← Seguridad</Link>
        <h1 className="mt-6 text-3xl font-bold">Protección del comprador</h1>
        <div className="mt-6 space-y-6 text-sm leading-7 text-muted-foreground">
          <p>
            Wetudy recomienda completar pagos y comunicaciones dentro de la plataforma para mantener trazabilidad de la operación.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Aplica mejor cuando</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>La operación nace desde un anuncio de Wetudy.</li>
              <li>El comprador y vendedor usan el chat de Wetudy.</li>
              <li>El pago se completa dentro de la plataforma.</li>
              <li>La incidencia se abre desde una operación registrada.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">No aplica igual cuando</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>El pago se realiza fuera de Wetudy.</li>
              <li>El acuerdo se cierra por canales externos.</li>
              <li>No existe anuncio, chat o pago vinculado.</li>
              <li>El producto o la entrega no pueden verificarse con el contexto de la plataforma.</li>
            </ul>
          </section>

          <p>
            La protección concreta dependerá del método de pago, envío, tipo de operación y condiciones vigentes en el momento de la compra.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
