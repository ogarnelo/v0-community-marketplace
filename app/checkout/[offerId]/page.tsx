import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, CircleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

function CheckoutUnavailable({
  title,
  description,
  href = "/messages",
  cta = "Volver a mensajes",
}: {
  title: string;
  description: string;
  href?: string;
  cta?: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Card className="border-amber-200">
          <CardHeader className="items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <CircleAlert className="size-7" />
            </div>
            <CardTitle className="text-2xl">{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-slate-600">{description}</p>
            <Button asChild>
              <Link href={href}>{cta}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

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

  const adminSupabase = createAdminClient();

  const { data: offer, error } = await adminSupabase
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
    return (
      <CheckoutUnavailable
        title="Pago no disponible"
        description="No hemos encontrado la oferta que intentas pagar. Puede que ya no exista o que el enlace no sea válido."
      />
    );
  }

  if (typedOffer.buyer_id !== user.id) {
    redirect("/messages");
  }

  if (typedOffer.status !== "accepted") {
    return (
      <CheckoutUnavailable
        title="Esta oferta aún no se puede pagar"
        description="El checkout solo está disponible para ofertas aceptadas. Revisa la conversación para ver el estado actual de la negociación."
        href="/messages"
      />
    );
  }

  if (!typedOffer.listings) {
    return (
      <CheckoutUnavailable
        title="Anuncio no disponible"
        description="No hemos podido cargar la información del anuncio asociada a esta oferta."
        href="/messages"
      />
    );
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
