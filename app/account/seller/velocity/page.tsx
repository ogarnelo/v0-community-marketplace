import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { createClient } from '@/lib/supabase/server';
import { getNavbarData } from '@/lib/navbar/get-navbar-data';
import { DEFAULT_SELLER_TEMPLATES, templateToSearchParams, type SellerTemplate } from '@/lib/seller/default-templates';
import SellerTemplateCard from '@/components/seller/seller-template-card';
import SaveTemplateForm from '@/components/seller/save-template-form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PackagePlus, UploadCloud, Zap } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Publicación rápida | Wetudy',
  robots: { index: false, follow: false },
};

function rowToTemplate(row: any): SellerTemplate {
  return {
    id: row.id,
    name: row.name,
    title: row.title || row.name,
    description: row.description || '',
    category: row.category || 'Material escolar',
    grade_level: row.grade_level || undefined,
    condition: row.condition || 'good',
    listing_type: row.listing_type === 'donation' ? 'donation' : 'sale',
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    original_price: row.original_price === null || row.original_price === undefined ? null : Number(row.original_price),
    isbn: row.isbn || null,
    badge: 'Tu plantilla',
  };
}

export default async function SellerVelocityPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth?next=/account/seller/velocity');

  const { data: savedTemplates } = await supabase
    .from('seller_publish_templates')
    .select('*')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })
    .limit(12);

  const customTemplates = (savedTemplates || []).map(rowToTemplate);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 lg:px-8">
        <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm lg:p-8">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">Seller Velocity</Badge>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Publica más productos en menos tiempo</h1>
              <p className="mt-3 max-w-3xl text-muted-foreground">
                Usa plantillas, publicación rápida con foto obligatoria e importación para aumentar inventario de calidad. Más inventario fiable significa más búsquedas cubiertas, más chats y más transacciones.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/marketplace/new/quick"><Zap className="mr-2 h-4 w-4" /> Publicar rápido con foto</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/account/business/import"><UploadCloud className="mr-2 h-4 w-4" /> Importar CSV</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border bg-card p-5">
            <Zap className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-semibold">1 minuto por anuncio</h2>
            <p className="mt-2 text-sm text-muted-foreground">Publica rápido, pero siempre con una foto real desde el primer momento.</p>
          </div>
          <div className="rounded-3xl border bg-card p-5">
            <PackagePlus className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-semibold">Plantillas reutilizables</h2>
            <p className="mt-2 text-sm text-muted-foreground">Libros, uniformes, calculadoras, material escolar y donaciones.</p>
          </div>
          <div className="rounded-3xl border bg-card p-5">
            <UploadCloud className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-semibold">Subida masiva</h2>
            <p className="mt-2 text-sm text-muted-foreground">Para negocios: pega CSV y crea muchos anuncios de golpe.</p>
          </div>
        </section>

        {customTemplates.length > 0 ? (
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Tus plantillas</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {customTemplates.map((template) => <SellerTemplateCard key={template.id} template={template} />)}
            </div>
          </section>
        ) : null}

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Plantillas recomendadas</h2>
            <SaveTemplateForm />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {DEFAULT_SELLER_TEMPLATES.map((template) => <SellerTemplateCard key={template.id} template={template} />)}
          </div>
        </section>

        <section className="rounded-3xl border bg-muted/40 p-6">
          <h2 className="font-semibold">Atajo estratégico</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Empieza por productos demandados y usa plantillas para crear variaciones: curso, talla, editorial, modelo o lote.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/account/business/opportunities">Ver productos demandados</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/account/growth">Ver asistente de ventas</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
