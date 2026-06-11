import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BoostCheckoutButton from "@/components/boosts/boost-checkout-button";
import { BOOST_PLANS, formatBoostPrice } from "@/lib/boosts/pricing";
import type { BoostPlanId } from "@/lib/boosts/pricing";

export default async function BoostListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { listingId } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, price, status, seller_id")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing) notFound();

  if (listing.seller_id !== user.id) redirect("/account/listings");

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <Link href="/account/listings" className="text-sm font-medium text-primary hover:underline">
          ← Volver a mis anuncios
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Destacar anuncio</h1>
        <p className="mt-2 text-muted-foreground">
          Aumenta la visibilidad de “{listing.title || "tu anuncio"}” en el marketplace.
        </p>
        {query.cancelled ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            El pago se canceló. Puedes elegir un plan y volver a intentarlo.
          </div>
        ) : null}
      </div>

      {listing.status !== "available" ? (
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Este anuncio no se puede destacar</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Solo puedes destacar anuncios disponibles. Estado actual: {listing.status}.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {BOOST_PLANS.map((plan) => (
            <div key={plan.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  {plan.badge}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-5 text-3xl font-bold">{formatBoostPrice(plan.amountCents)}</p>
              <p className="mb-5 mt-1 text-xs text-muted-foreground">
                Visibilidad extra durante {plan.days} días.
              </p>
              <BoostCheckoutButton listingId={listing.id} planId={plan.id as BoostPlanId} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-2xl border bg-muted/40 p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Cómo funciona</p>
        <p className="mt-2">
          Un anuncio destacado vuelve a ganar prioridad en el marketplace y se marca visualmente para aumentar confianza y clics.
        </p>
      </div>
    </div>
  );
}
