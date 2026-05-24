import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import BusinessCsvImporter from "@/components/business/business-csv-importer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UploadCloud } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Importar productos | Wetudy negocios",
  robots: { index: false, follow: false },
};

export default async function BusinessImportPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/business/import");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 lg:px-8">
        <Button asChild variant="ghost" className="mb-4 gap-2 px-0">
          <Link href="/account/business">
            <ArrowLeft className="h-4 w-4" />
            Volver al panel profesional
          </Link>
        </Button>

        <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
          <UploadCloud className="h-8 w-8 text-primary" />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Importación rápida de productos</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Sube muchos productos en poco tiempo. Ideal para librerías, papelerías, academias y tiendas con stock educativo.
          </p>
        </section>

        <BusinessCsvImporter />

        <section className="mt-8 rounded-3xl border bg-muted/40 p-6">
          <h2 className="font-semibold">Plantilla recomendada</h2>
          <code className="mt-3 block overflow-x-auto rounded-2xl bg-background p-3 text-xs">
            title,description,price,category,condition,grade_level,isbn
          </code>
          <p className="mt-3 text-sm text-muted-foreground">
            Para vender más rápido, prioriza productos que aparecen en “Productos demandados”.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
