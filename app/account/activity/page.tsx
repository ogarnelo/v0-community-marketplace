
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/marketplace/formatters";
import { ReviewTransactionCard } from "@/components/account/review-transaction-card";
import type { DonationRequestRow, ListingOfferRow, ListingRow, PaymentIntentRow, ProfileRow, ReviewRow } from "@/lib/types/marketplace";

function getActivityStatusLabel(status: string | null) {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "countered":
      return "Contraoferta";
    case "accepted":
      return "Aceptada";
    case "paid":
      return "Pago completado";
    case "processing":
      return "Pago en proceso";
    case "requires_payment_method":
      return "Pendiente de pago";
    case "approved":
      return "Aprobada";
    case "rejected":
      return "Rechazada";
    case "failed":
      return "Pago fallido";
    case "refunded":
      return "Reembolsado";
    case "withdrawn":
      return "Retirada";
    case "cancelled":
      return "Cancelada";
    case "completed":
      return "Completada";
    default:
      return status || "Sin estado";
  }
}

function getActivityStatusClass(status: string | null) {
  switch (status) {
    case "pending":
    case "requires_payment_method":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "countered":
    case "processing":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "accepted":
    case "approved":
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
    case "cancelled":
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "completed":
    case "refunded":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "";
  }
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AccountActivityPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const [{ data: sentOffersData }, { data: receivedOffersData }, { data: myListingsData }, { data: sentDonationData }, { data: buyerPaymentsData }, { data: sellerPaymentsData }] =
    await Promise.all([
      adminSupabase
        .from("listing_offers")
        .select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, accepted_amount, status, counter_price, created_at, responded_at")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false }),
      adminSupabase
        .from("listing_offers")
        .select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, accepted_amount, status, counter_price, created_at, responded_at")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false }),
      adminSupabase.from("listings").select("id, title, seller_id").eq("seller_id", user.id),
      adminSupabase
        .from("donation_requests")
        .select("id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, created_at, updated_at, school_id")
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false }),
      adminSupabase
        .from("payment_intents")
        .select("id, offer_id, listing_id, buyer_id, seller_id, amount, status, updated_at, created_at")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false }),
      adminSupabase
        .from("payment_intents")
        .select("id, offer_id, listing_id, buyer_id, seller_id, amount, status, updated_at, created_at")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  const myListings = (myListingsData || []) as ListingRow[];
  const myListingIds = myListings.map((listing) => listing.id);

  let receivedDonationData: DonationRequestRow[] = [];
  if (myListingIds.length > 0) {
    const { data } = await adminSupabase
      .from("donation_requests")
      .select("id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, created_at, updated_at, school_id")
      .in("listing_id", myListingIds)
      .order("created_at", { ascending: false });

    receivedDonationData = (data || []) as DonationRequestRow[];
  }

  const sentOffers = (sentOffersData || []) as ListingOfferRow[];
  const receivedOffers = (receivedOffersData || []) as ListingOfferRow[];
  const sentDonations = (sentDonationData || []) as DonationRequestRow[];
  const receivedDonations = receivedDonationData;
  const buyerPayments = (buyerPaymentsData || []) as PaymentIntentRow[];
  const sellerPayments = (sellerPaymentsData || []) as PaymentIntentRow[];

  const allOffers = [...sentOffers, ...receivedOffers];
  const allDonations = [...sentDonations, ...receivedDonations];
  const allPayments = [...buyerPayments, ...sellerPayments];

  const listingIds = Array.from(new Set([
    ...allOffers.map((offer) => offer.listing_id),
    ...allDonations.map((request) => request.listing_id).filter((value): value is string => !!value),
    ...allPayments.map((payment) => payment.listing_id).filter((value): value is string => !!value),
  ]));

  const profileIds = Array.from(new Set([
    ...allOffers.map((offer) => offer.buyer_id),
    ...allOffers.map((offer) => offer.seller_id),
    ...allDonations.map((request) => request.requester_id).filter((value): value is string => !!value),
    ...allPayments.map((payment) => payment.buyer_id).filter((value): value is string => !!value),
    ...allPayments.map((payment) => payment.seller_id).filter((value): value is string => !!value),
  ]));

  const paidListingIds = allPayments.filter((payment) => payment.status === "paid" && payment.listing_id).map((payment) => payment.listing_id as string);

  const [listingsResult, profilesResult, reviewsResult] = await Promise.all([
    listingIds.length > 0 ? adminSupabase.from("listings").select("id, title").in("id", listingIds) : Promise.resolve({ data: [] as Partial<ListingRow>[] }),
    profileIds.length > 0 ? adminSupabase.from("profiles").select("id, full_name").in("id", profileIds) : Promise.resolve({ data: [] as Partial<ProfileRow>[] }),
    paidListingIds.length > 0
      ? adminSupabase.from("reviews").select("id, reviewer_id, reviewed_user_id, listing_id").eq("reviewer_id", user.id).in("listing_id", paidListingIds)
      : Promise.resolve({ data: [] as Partial<ReviewRow>[] }),
  ]);

  const listingsMap = new Map((listingsResult.data || []).map((row: any) => [row.id, row.title || "Anuncio"]));
  const profilesMap = new Map((profilesResult.data || []).map((row: any) => [row.id, row.full_name || "Usuario"]));
  const paymentsByOfferId = new Map(allPayments.filter((row) => !!row.offer_id).map((row) => [row.offer_id as string, row]));
  const existingReviewKeys = new Set(((reviewsResult.data || []) as ReviewRow[]).map((review) => `${review.listing_id}:${review.reviewed_user_id}`));

  const resolveOfferAmount = (offer: ListingOfferRow) => offer.accepted_amount ?? offer.current_amount ?? offer.counter_price ?? offer.offered_price;

  const shouldPromptReview = (payment: PaymentIntentRow, reviewedUserId: string | null | undefined) => {
    if (payment.status !== "paid" || !payment.listing_id || !reviewedUserId) {
      return false;
    }

    return !existingReviewKeys.has(`${payment.listing_id}:${reviewedUserId}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Actividad</h1>
          <p className="text-muted-foreground">Seguimiento de ofertas, pagos, valoraciones y solicitudes de donación.</p>
        </div>
        <Link href="/account/listings" className="text-sm font-medium text-[#7EBA28] hover:underline">
          Volver a mis anuncios
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Compras realizadas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {buyerPayments.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has completado compras.</p> : buyerPayments.map((payment) => {
              const sellerName = profilesMap.get(payment.seller_id || "") || "Usuario";
              return (
                <div key={payment.id} className="space-y-3 rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{listingsMap.get(payment.listing_id || "") || "Anuncio"}</p>
                      <p className="text-sm text-muted-foreground">Vendedor: {sellerName}</p>
                      <p className="text-sm text-muted-foreground">Importe: {formatPrice(payment.amount || 0)}</p>
                    </div>
                    <Badge variant="outline" className={getActivityStatusClass(payment.status)}>{getActivityStatusLabel(payment.status)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(payment.updated_at || payment.created_at || null)}</p>
                  {shouldPromptReview(payment, payment.seller_id) ? (
                    <ReviewTransactionCard
                      paymentIntentId={payment.id}
                      listingTitle={listingsMap.get(payment.listing_id || "") || "Anuncio"}
                      counterpartName={sellerName}
                      roleLabel="vendedor"
                    />
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ventas cobradas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sellerPayments.length === 0 ? <p className="text-sm text-muted-foreground">Aún no tienes ventas cobradas.</p> : sellerPayments.map((payment) => {
              const buyerName = profilesMap.get(payment.buyer_id || "") || "Usuario";
              return (
                <div key={payment.id} className="space-y-3 rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{listingsMap.get(payment.listing_id || "") || "Anuncio"}</p>
                      <p className="text-sm text-muted-foreground">Comprador: {buyerName}</p>
                      <p className="text-sm text-muted-foreground">Importe: {formatPrice(payment.amount || 0)}</p>
                    </div>
                    <Badge variant="outline" className={getActivityStatusClass(payment.status)}>{getActivityStatusLabel(payment.status)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(payment.updated_at || payment.created_at || null)}</p>
                  {shouldPromptReview(payment, payment.buyer_id) ? (
                    <ReviewTransactionCard
                      paymentIntentId={payment.id}
                      listingTitle={listingsMap.get(payment.listing_id || "") || "Anuncio"}
                      counterpartName={buyerName}
                      roleLabel="comprador"
                    />
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ofertas enviadas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sentOffers.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has enviado ofertas.</p> : sentOffers.map((offer) => {
              const payment = paymentsByOfferId.get(offer.id);
              return (
                <div key={offer.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{listingsMap.get(offer.listing_id) || "Anuncio"}</p>
                      <p className="text-sm text-muted-foreground">Vendedor: {profilesMap.get(offer.seller_id) || "Usuario"}</p>
                      <p className="text-sm text-muted-foreground">Importe: {formatPrice(resolveOfferAmount(offer))}</p>
                    </div>
                    <Badge variant="outline" className={getActivityStatusClass(payment?.status || offer.status)}>{getActivityStatusLabel(payment?.status || offer.status)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(payment?.updated_at || offer.responded_at || offer.created_at)}</p>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ofertas recibidas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {receivedOffers.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has recibido ofertas.</p> : receivedOffers.map((offer) => {
              const payment = paymentsByOfferId.get(offer.id);
              return (
                <div key={offer.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{listingsMap.get(offer.listing_id) || "Anuncio"}</p>
                      <p className="text-sm text-muted-foreground">Comprador: {profilesMap.get(offer.buyer_id) || "Usuario"}</p>
                      <p className="text-sm text-muted-foreground">Importe: {formatPrice(resolveOfferAmount(offer))}</p>
                    </div>
                    <Badge variant="outline" className={getActivityStatusClass(payment?.status || offer.status)}>{getActivityStatusLabel(payment?.status || offer.status)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(payment?.updated_at || offer.responded_at || offer.created_at)}</p>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Solicitudes de donación enviadas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sentDonations.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has solicitado donaciones.</p> : sentDonations.map((request) => (
              <div key={request.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{listingsMap.get(request.listing_id || "") || "Anuncio"}</p>
                    <p className="text-sm text-muted-foreground">Estado: {request.status || "pending"}</p>
                    {request.note ? <p className="text-sm text-muted-foreground">Nota: {request.note}</p> : null}
                  </div>
                  <Badge variant="outline" className={getActivityStatusClass(request.status)}>{getActivityStatusLabel(request.status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(request.updated_at || request.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Solicitudes de donación recibidas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {receivedDonations.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has recibido solicitudes de donación.</p> : receivedDonations.map((request) => (
              <div key={request.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{listingsMap.get(request.listing_id || "") || "Anuncio"}</p>
                    <p className="text-sm text-muted-foreground">Solicitante: {profilesMap.get(request.requester_id || "") || "Usuario"}</p>
                    {request.note ? <p className="text-sm text-muted-foreground">Nota: {request.note}</p> : null}
                  </div>
                  <Badge variant="outline" className={getActivityStatusClass(request.status)}>{getActivityStatusLabel(request.status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(request.updated_at || request.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
