import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRecommendations } from "@/lib/marketplace/get-recommendations";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/feed");

  const recs = await getRecommendations(user.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
      <div className="mb-6 rounded-3xl border bg-card p-5 shadow-sm">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Feed personalizado
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Recomendado para ti</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Basado en tus preferencias, curso e intereses. Cuanto más uses Wetudy, mejores serán las recomendaciones.
        </p>
      </div>

      {recs.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold">Aún no tenemos suficientes señales</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Completa tus preferencias o explora el marketplace para personalizar tu feed.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild><Link href="/onboarding/preferences">Completar preferencias</Link></Button>
            <Button asChild variant="outline"><Link href="/marketplace">Explorar marketplace</Link></Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {recs.map((listing: any) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
