import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import QuickListingForm, { type QuickListingInitialValues } from '@/components/marketplace/quick-listing-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Publicación rápida | Wetudy',
  robots: { index: false, follow: false },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || '';
}

export default async function QuickNewListingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth?next=/marketplace/new/quick');

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .maybeSingle();

  const initialValues: QuickListingInitialValues = {
    title: first(params.title),
    description: first(params.description),
    category: first(params.category),
    grade_level: first(params.grade_level),
    condition: first(params.condition),
    listing_type: first(params.listing_type),
    price: first(params.price),
    original_price: first(params.original_price),
    isbn: first(params.isbn),
    source: first(params.source),
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 lg:px-8">
        <Button asChild variant="ghost" className="mb-4 gap-2 px-0">
          <Link href="/account/seller/velocity">
            <ArrowLeft className="h-4 w-4" />
            Volver a publicación rápida
          </Link>
        </Button>

        <section className="mb-6 rounded-3xl border bg-card p-6 shadow-sm">
          <Zap className="h-8 w-8 text-primary" />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Publicación rápida</h1>
          <p className="mt-2 text-muted-foreground">
            Crea un anuncio en menos de un minuto, pero siempre con al menos una foto real. Sin foto no se publica: la confianza del comprador es prioritaria.
          </p>
        </section>

        <QuickListingForm initialSchoolId={(profile as any)?.school_id || null} initialValues={initialValues} />
    </main>
  );
}
