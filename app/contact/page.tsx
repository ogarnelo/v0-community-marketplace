import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Building2, HelpCircle, Mail, ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Contacto y soporte | Wetudy",
  description: "Contacta con Wetudy para soporte, incidencias, dudas sobre pagos o colaboración con negocios locales.",
};

export default async function ContactPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contacto y soporte</h1>
          <p className="mt-3 text-muted-foreground">
            Si tienes un problema con una compra o venta, abre una incidencia desde la operación. Para dudas generales,
            colaboración o negocios locales, escríbenos.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <Mail className="h-6 w-6 text-primary" />
              <h2 className="mt-3 font-semibold">Soporte</h2>
              <p className="mt-2 text-sm text-muted-foreground">support@wetudy.com</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <ShieldAlert className="h-6 w-6 text-primary" />
              <h2 className="mt-3 font-semibold">Incidencias</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Desde la operación, para mantener anuncio, chat y pago vinculados.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <Building2 className="h-6 w-6 text-primary" />
              <h2 className="mt-3 font-semibold">Negocios</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Librerías, papelerías y academias pueden escribirnos para colaborar.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <HelpCircle className="h-6 w-6 text-primary" />
              <h2 className="mt-3 font-semibold">Ayuda</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                <Link href="/help" className="text-primary hover:underline">Centro de ayuda</Link>
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 rounded-3xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <AlertTriangle className="h-7 w-7 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Para problemas con una operación</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                No cierres el caso por fuera. Entra en tu actividad, abre la operación y crea una incidencia para que Wetudy pueda revisar el contexto.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild><Link href="/account/activity">Ver mi actividad</Link></Button>
                <Button asChild variant="outline"><Link href="/help">Ver ayuda</Link></Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
