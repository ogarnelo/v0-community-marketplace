import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { CheckoutSummary } from "@/components/payments/checkout-summary";
import { formatPrice } from "@/lib/marketplace/formatters";
import { getAcceptedOfferAmount } from "@/lib/payments/offer-amount";

type OfferPageRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  offered_price: number | null;
  current_amount?: number | null;
  accepted_amount?: number | null;
  counter_price?: number | null;
  status: string | null;
  listings?: {
    id: string;
    title: string | null;
    price: number | null;
    status: string | null;
  } | null;
};

export default async function CheckoutOfferPage({
  params,
}: {
  params: Promise<{ offerId: string }>;
}) {
  const { offerId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: offer, error } = await supabase
    .from("listing_offers")
    .select(`
      id,
      listing_id,
      buyer_id,
      seller_id,
      offered_price,
      current_amount,
      accepted_amount,
      counter_price,
      status,
      listings:listing_id (
        id,
        title,
        price,
        status
      )
    `)
    .eq("id", offerId)
    .maybeSingle();

  const typedOffer = (offer as OfferPageRow | null) ?? null;

  if (error || !typedOffer) {
    notFound();
  }

  if (typedOffer.buyer_id !== user.id) {
    redirect("/messages");
  }

  if (typedOffer.status !== "accepted") {
    redirect(`/messages/${typedOffer.listing_id}`);
  }

  if (!typedOffer.listings) {
    notFound();
  }

  const acceptedAmount = getAcceptedOfferAmount(typedOffer);

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/messages"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ChevronLeft className="size-4" />
            Volver a mensajes
          </Link>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Preparar pago
          </h1>
          <p className="text-sm text-slate-600">
            Revisa el importe final y completa el pago de forma segura con Stripe.
          </p>
        </div>

        <Card className="border-slate-200">
          <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anuncio</p>
              <p className="mt-1 font-medium text-slate-900">{typedOffer.listings.title || "Artículo sin título"}</p>
              <p className="mt-2 text-sm text-slate-600">
                Estado actual del anuncio: <span className="font-medium">{typedOffer.listings.status || "available"}</span>
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Importe acordado</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatPrice(acceptedAmount)}</p>
            </div>
          </CardContent>
        </Card>

        <CheckoutSummary
          offerId={typedOffer.id}
          listingTitle={typedOffer.listings.title || "Artículo sin título"}
          acceptedAmount={acceptedAmount}
        />
      </div>
    </main>
  );
}
