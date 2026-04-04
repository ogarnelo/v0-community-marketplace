import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/marketplace/formatters";
import type { DonationRequestRow, ListingOfferRow, ListingRow, ProfileRow } from "@/lib/types/marketplace";


function getActivityStatusLabel(status: string | null) {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "countered":
      return "Contraoferta";
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    case "completed":
      return "Completada";
    case "approved":
      return "Aprobada";
    case "cancelled":
      return "Cancelada";
    default:
      return status || "Sin estado";
  }
}

function getActivityStatusClass(status: string | null) {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "countered":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "accepted":
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
    case "cancelled":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "completed":
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const [{ data: sentOffersData }, { data: receivedOffersData }, { data: myListingsData }, { data: sentDonationData }] =
    await Promise.all([
      supabase
        .from("listing_offers")
        .select("id, listing_id, buyer_id, seller_id, offered_price, status, counter_price, created_at, responded_at")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("listing_offers")
        .select("id, listing_id, buyer_id, seller_id, offered_price, status, counter_price, created_at, responded_at")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("listings")
        .select("id, title, seller_id")
        .eq("seller_id", user.id),
      supabase
        .from("donation_requests")
        .select("id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, created_at, updated_at, school_id")
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  const myListings = (myListingsData || []) as ListingRow[];
  const myListingIds = myListings.map((listing) => listing.id);

  let receivedDonationData: DonationRequestRow[] = [];
  if (myListingIds.length > 0) {
    const { data } = await supabase
      .from("donation_requests")
      .select("id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, created_at, updated_at, school_id")
      .in("listing_id", myListingIds)
      .order("created_at", { ascending: false });

    receivedDonationData = (data || []) as DonationRequestRow[];
  }

  const allOffers = [...((sentOffersData || []) as ListingOfferRow[]), ...((receivedOffersData || []) as ListingOfferRow[])];
  const allDonations = [...((sentDonationData || []) as DonationRequestRow[]), ...receivedDonationData];

  const listingIds = Array.from(
    new Set([
      ...allOffers.map((offer) => offer.listing_id),
      ...allDonations
        .map((request) => request.listing_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ])
  ) as string[];

  const profileIds = Array.from(
    new Set([
      ...allOffers.map((offer) => offer.buyer_id),
      ...allOffers.map((offer) => offer.seller_id),
      ...allDonations
        .map((request) => request.requester_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ].filter(Boolean))
  ) as string[];

  const [listingsResult, profilesResult] = await Promise.all([
    listingIds.length > 0
      ? supabase.from("listings").select("id, title").in("id", listingIds)
      : Promise.resolve({ data: [] as Partial<ListingRow>[] }),
    profileIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : Promise.resolve({ data: [] as Partial<ProfileRow>[] }),
  ]);

  const listingsMap = new Map((listingsResult.data || []).map((row: any) => [row.id, row.title || "Anuncio"]));
  const profilesMap = new Map((profilesResult.data || []).map((row: any) => [row.id, row.full_name || "Usuario"]));

  const sentOffers = (sentOffersData || []) as ListingOfferRow[];
  const receivedOffers = (receivedOffersData || []) as ListingOfferRow[];
  const sentDonations = (sentDonationData || []) as DonationRequestRow[];
  const receivedDonations = receivedDonationData;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Actividad</h1>
          <p className="text-muted-foreground">Seguimiento de ofertas y solicitudes de donación.</p>
        </div>
        <Link href="/account/listings" className="text-sm font-medium text-[#7EBA28] hover:underline">
          Volver a mis anuncios
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Ofertas enviadas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sentOffers.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has enviado ofertas.</p> : sentOffers.map((offer) => (
              <div key={offer.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{listingsMap.get(offer.listing_id) || "Anuncio"}</p>
                    <p className="text-sm text-muted-foreground">Vendedor: {profilesMap.get(offer.seller_id) || "Usuario"}</p>
                    <p className="text-sm text-muted-foreground">Importe: {formatPrice(offer.counter_price ?? offer.offered_price)}</p>
                  </div>
                  <Badge variant="outline" className={getActivityStatusClass(offer.status)}>{getActivityStatusLabel(offer.status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(offer.responded_at || offer.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ofertas recibidas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {receivedOffers.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has recibido ofertas.</p> : receivedOffers.map((offer) => (
              <div key={offer.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{listingsMap.get(offer.listing_id) || "Anuncio"}</p>
                    <p className="text-sm text-muted-foreground">Comprador: {profilesMap.get(offer.buyer_id) || "Usuario"}</p>
                    <p className="text-sm text-muted-foreground">Importe: {formatPrice(offer.counter_price ?? offer.offered_price)}</p>
                  </div>
                  <Badge variant="outline" className={getActivityStatusClass(offer.status)}>{getActivityStatusLabel(offer.status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(offer.responded_at || offer.created_at)}</p>
              </div>
            ))}
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
