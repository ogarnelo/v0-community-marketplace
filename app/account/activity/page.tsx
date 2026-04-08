import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/marketplace/formatters";
import type {
  DonationRequestEventRow,
  DonationRequestRow,
  ListingOfferEventRow,
  ListingOfferRow,
  ListingRow,
  ProfileRow,
} from "@/lib/types/marketplace";

function label(status: string | null) {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "countered":
      return "En negociación";
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    case "approved":
      return "Aprobada";
    case "cancelled":
      return "Cancelada";
    case "completed":
      return "Completada";
    default:
      return status || "Sin estado";
  }
}

function badgeClass(status: string | null) {
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
    default:
      return "";
  }
}

function date(value: string | null) {
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

  const admin = createAdminClient();

  const [{ data: myListings }, { data: sentOffers }, { data: receivedOffers }, { data: sentDonations }] = await Promise.all([
    admin.from("listings").select("id, title, seller_id").eq("seller_id", user.id),
    admin.from("listing_offers").select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, current_actor, rounds_count, accepted_amount, status, counter_price, created_at, responded_at").eq("buyer_id", user.id).order("created_at", { ascending: false }),
    admin.from("listing_offers").select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, current_actor, rounds_count, accepted_amount, status, counter_price, created_at, responded_at").eq("seller_id", user.id).order("created_at", { ascending: false }),
    admin.from("donation_requests").select("id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, created_at, updated_at, school_id").eq("requester_id", user.id).order("created_at", { ascending: false }),
  ]);

  const myListingIds = ((myListings || []) as ListingRow[]).map((row) => row.id);

  const [{ data: receivedDonations }, { data: offerEvents }, { data: donationEvents }] = await Promise.all([
    myListingIds.length
      ? admin.from("donation_requests").select("id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, created_at, updated_at, school_id").in("listing_id", myListingIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as DonationRequestRow[] }),
    admin.from("listing_offer_events").select("id, offer_id, conversation_id, actor_id, actor_role, event_type, amount, round_number, status_snapshot, created_at"),
    admin.from("donation_request_events").select("id, request_id, conversation_id, actor_id, event_type, note, status_snapshot, created_at"),
  ]);

  const allOffers = [...((sentOffers || []) as ListingOfferRow[]), ...((receivedOffers || []) as ListingOfferRow[])];
  const allDonations = [...((sentDonations || []) as DonationRequestRow[]), ...((receivedDonations || []) as DonationRequestRow[])];

  const listingIds = Array.from(new Set([
    ...allOffers.map((row) => row.listing_id),
    ...allDonations.map((row) => row.listing_id).filter(Boolean) as string[],
  ]));

  const profileIds = Array.from(new Set([
    ...allOffers.flatMap((row) => [row.buyer_id, row.seller_id]),
    ...allDonations.map((row) => row.requester_id).filter(Boolean) as string[],
  ]));

  const [listingsResult, profilesResult] = await Promise.all([
    listingIds.length ? admin.from("listings").select("id, title").in("id", listingIds) : Promise.resolve({ data: [] as Partial<ListingRow>[] }),
    profileIds.length ? admin.from("profiles").select("id, full_name").in("id", profileIds) : Promise.resolve({ data: [] as Partial<ProfileRow>[] }),
  ]);

  const listingsMap = new Map((listingsResult.data || []).map((row: any) => [row.id, row.title || "Anuncio"]));
  const profilesMap = new Map((profilesResult.data || []).map((row: any) => [row.id, row.full_name || "Usuario"]));

  const offerEventsByOfferId = new Map<string, ListingOfferEventRow[]>();
  for (const event of ((offerEvents || []) as ListingOfferEventRow[])) {
    if (!offerEventsByOfferId.has(event.offer_id)) offerEventsByOfferId.set(event.offer_id, []);
    offerEventsByOfferId.get(event.offer_id)!.push(event);
  }
  for (const entry of offerEventsByOfferId.values()) entry.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));

  const donationEventsByRequestId = new Map<string, DonationRequestEventRow[]>();
  for (const event of ((donationEvents || []) as DonationRequestEventRow[])) {
    if (!donationEventsByRequestId.has(event.request_id)) donationEventsByRequestId.set(event.request_id, []);
    donationEventsByRequestId.get(event.request_id)!.push(event);
  }
  for (const entry of donationEventsByRequestId.values()) entry.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));

  const sentOffersSafe = (sentOffers || []) as ListingOfferRow[];
  const receivedOffersSafe = (receivedOffers || []) as ListingOfferRow[];
  const sentDonationsSafe = (sentDonations || []) as DonationRequestRow[];
  const receivedDonationsSafe = (receivedDonations || []) as DonationRequestRow[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Actividad</h1>
          <p className="text-muted-foreground">Seguimiento de ofertas y solicitudes de donación.</p>
        </div>
        <Link href="/account/listings" className="text-sm font-medium text-[#7EBA28] hover:underline">Volver a mis anuncios</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Ofertas enviadas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sentOffersSafe.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has enviado ofertas.</p> : sentOffersSafe.map((offer) => {
              const events = offerEventsByOfferId.get(offer.id) || [];
              const latest = events.at(-1);
              return (
                <div key={offer.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{listingsMap.get(offer.listing_id) || "Anuncio"}</p>
                      <p className="text-sm text-muted-foreground">Vendedor: {profilesMap.get(offer.seller_id) || "Usuario"}</p>
                      <p className="text-sm text-muted-foreground">Importe actual: {formatPrice(offer.current_amount ?? offer.counter_price ?? offer.offered_price)}</p>
                      {latest ? <p className="text-xs text-muted-foreground">Último evento: {latest.event_type}</p> : null}
                    </div>
                    <Badge variant="outline" className={badgeClass(offer.status)}>{label(offer.status)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{date(offer.responded_at || offer.created_at)}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ofertas recibidas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {receivedOffersSafe.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has recibido ofertas.</p> : receivedOffersSafe.map((offer) => {
              const events = offerEventsByOfferId.get(offer.id) || [];
              const latest = events.at(-1);
              return (
                <div key={offer.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{listingsMap.get(offer.listing_id) || "Anuncio"}</p>
                      <p className="text-sm text-muted-foreground">Comprador: {profilesMap.get(offer.buyer_id) || "Usuario"}</p>
                      <p className="text-sm text-muted-foreground">Importe actual: {formatPrice(offer.current_amount ?? offer.counter_price ?? offer.offered_price)}</p>
                      {latest ? <p className="text-xs text-muted-foreground">Último evento: {latest.event_type}</p> : null}
                    </div>
                    <Badge variant="outline" className={badgeClass(offer.status)}>{label(offer.status)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{date(offer.responded_at || offer.created_at)}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Solicitudes de donación enviadas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sentDonationsSafe.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has solicitado donaciones.</p> : sentDonationsSafe.map((request) => {
              const latest = (donationEventsByRequestId.get(request.id) || []).at(-1);
              return (
                <div key={request.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{listingsMap.get(request.listing_id || "") || "Anuncio"}</p>
                      {request.note ? <p className="text-sm text-muted-foreground">{request.note}</p> : null}
                      {latest ? <p className="text-xs text-muted-foreground">Último evento: {latest.event_type}</p> : null}
                    </div>
                    <Badge variant="outline" className={badgeClass(request.status)}>{label(request.status)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{date(request.updated_at || request.created_at)}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Solicitudes de donación recibidas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {receivedDonationsSafe.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has recibido solicitudes de donación.</p> : receivedDonationsSafe.map((request) => {
              const latest = (donationEventsByRequestId.get(request.id) || []).at(-1);
              return (
                <div key={request.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{listingsMap.get(request.listing_id || "") || "Anuncio"}</p>
                      <p className="text-sm text-muted-foreground">Solicitante: {profilesMap.get(request.requester_id || "") || "Usuario"}</p>
                      {request.note ? <p className="text-sm text-muted-foreground">{request.note}</p> : null}
                      {latest ? <p className="text-xs text-muted-foreground">Último evento: {latest.event_type}</p> : null}
                    </div>
                    <Badge variant="outline" className={badgeClass(request.status)}>{label(request.status)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{date(request.updated_at || request.created_at)}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
