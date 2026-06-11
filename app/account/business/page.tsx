import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Lightbulb, PackagePlus, Store, UploadCloud } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Panel profesional | Wetudy",
  robots: { index: false, follow: false },
};

export default async function BusinessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/business");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm lg:p-8">
        <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
          Perfil profesional
        </Badge>
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Store className="h-9 w-9 text-primary" />
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
              Sube productos escolares y vende a la comunidad educativa
            </h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Este panel está pensado para distribuidores, tiendas y negocios con stock escolar. Puedes empezar con un producto, importar un CSV o revisar qué está demandando la comunidad.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/account/business/import">
              <UploadCloud className="mr-2 h-4 w-4" />
              Importar productos
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/account/business/import" className="rounded-3xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md">
          <FileSpreadsheet className="h-7 w-7 text-primary" />
          <h2 className="mt-4 font-semibold">Subir Excel/CSV</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Descarga la plantilla, rellena productos con foto pública y crea muchos anuncios de golpe.
          </p>
        </Link>
        <Link href="/marketplace/new/quick" className="rounded-3xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md">
          <PackagePlus className="h-7 w-7 text-primary" />
          <h2 className="mt-4 font-semibold">Publicar un producto</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ideal para probar un primer producto con foto obligatoria, precio, categoría y curso.
          </p>
        </Link>
        <Link href="/account/business/opportunities" className="rounded-3xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md">
          <Lightbulb className="h-7 w-7 text-primary" />
          <h2 className="mt-4 font-semibold">Productos demandados</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Revisa señales agregadas de demanda para decidir qué productos subir primero.
          </p>
        </Link>
      </section>

      <section className="mt-8 rounded-3xl border bg-muted/40 p-6">
        <h2 className="font-semibold">Cómo pretende funcionar Wetudy para negocios</h2>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>1. Creas o usas tu perfil profesional.</li>
          <li>2. Subes producto nuevo, outlet, stock escolar o packs con fotos.</li>
          <li>3. Wetudy los coloca en el contexto correcto: curso, categoría, ISBN y comunidad.</li>
          <li>4. Las familias contactan, compran o guardan búsquedas para recibir avisos.</li>
        </ol>
      </section>
    </main>
  );
}
