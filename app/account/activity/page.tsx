import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/marketplace/formatters";
import { ActivityNotificationsList } from "@/components/notifications/activity-notifications-list";
import type { AppNotificationRow } from "@/lib/notifications";
import type { DonationRequestRow, ListingOfferRow, ListingRow } from "@/lib/types/marketplace";

type AgreementRow = {
  id: string;
  listing_id: string | null;
  buyer_id: string | null;
  seller_id: string | null;
  status: string | null;
  amount: number | null;
  created_at: string | null;
  confirmed_at: string | null;
};

type ConversationRow = {
  id: string;
  listing_id: string | null;
  buyer_id: string | null;
  seller_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function getStatusLabel(status: string | null) {
  switch (status) {
    case "pending": return "Pendiente";
    case "countered": return "Contraoferta";
    case "accepted": return "Aceptada";
    case "approved": return "Aprobada";
    case "rejected": return "Rechazada";
    case "withdrawn": return "Retirada";
    case "cancelled": return "Cancelada";
    case "completed": return "Completada";
    case "buyer_confirmed": return "Confirmado por comprador";
    case "seller_confirmed": return "Confirmado por vendedor";
    case "confirmed": return "Confirmado";
    case "disputed": return "Incidencia abierta";
    default: return status || "Sin estado";
  }
}

function getStatusClass(status: string | null) {
  switch (status) {
    case "pending": return "border-amber-200 bg-amber-50 text-amber-700";
    case "countered": return "border-sky-200 bg-sky-50 text-sky-700";
    case "accepted":
    case "approved":
    case "buyer_confirmed":
    case "seller_confirmed": return "border-blue-200 bg-blue-50 text-blue-700";
    case "confirmed":
    case "completed": return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
    case "cancelled":
    case "disputed": return "border-rose-200 bg-rose-50 text-rose-700";
    default: return "";
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

function resolveOfferAmount(offer: ListingOfferRow) {
  return offer.accepted_amount ?? offer.current_amount ?? offer.counter_price ?? offer.offered_price;
}

export default async function AccountActivityPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const [sentOffersResult, receivedOffersResult, myListingsResult, sentDonationsResult, conversationsResult, agreementsResult, notificationsResult] = await Promise.all([
    adminSupabase.from("listing_offers").select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, accepted_amount, status, counter_price, created_at, responded_at").eq("buyer_id", user.id).order("created_at", { ascending: false }),
    adminSupabase.from("listing_offers").select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, accepted_amount, status, counter_price, created_at, responded_at").eq("seller_id", user.id).order("created_at", { ascending: false }),
    adminSupabase.from("listings").select("id, title, seller_id").eq("seller_id", user.id),
    adminSupabase.from("donation_requests").select("id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, created_at, updated_at, school_id").eq("requester_id", user.id).order("created_at", { ascending: false }),
    adminSupabase.from("conversations").select("id, listing_id, buyer_id, seller_id, created_at, updated_at").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order("updated_at", { ascending: false }),
    adminSupabase.from("agreements").select("id, listing_id, buyer_id, seller_id, status, amount, created_at, confirmed_at").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order("created_at", { ascending: false }),
    supabase.from("notifications").select("id, user_id, kind, title, body, href, metadata, read_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);

  const myListings = (myListingsResult.data || []) as ListingRow[];
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

  const sentOffers = (sentOffersResult.data || []) as ListingOfferRow[];
  const receivedOffers = (receivedOffersResult.data || []) as ListingOfferRow[];
  const sentDonations = (sentDonationsResult.data || []) as DonationRequestRow[];
  const receivedDonations = receivedDonationData;
  const conversations = (conversationsResult.data || []) as ConversationRow[];
  const agreements = (agreementsResult.data || []) as AgreementRow[];
  const notifications = (notificationsResult.data || []) as AppNotificationRow[];

  const listingIds = Array.from(new Set([
    ...sentOffers.map((offer) => offer.listing_id),
    ...receivedOffers.map((offer) => offer.listing_id),
    ...sentDonations.map((request) => request.listing_id).filter((value): value is string => !!value),
    ...receivedDonations.map((request) => request.listing_id).filter((value): value is string => !!value),
    ...conversations.map((conversation) => conversation.listing_id).filter((value): value is string => !!value),
    ...agreements.map((agreement) => agreement.listing_id).filter((value): value is string => !!value),
  ]));

  const profileIds = Array.from(new Set([
    ...sentOffers.map((offer) => offer.seller_id),
    ...receivedOffers.map((offer) => offer.buyer_id),
    ...conversations.map((conversation) => conversation.buyer_id).filter((value): value is string => !!value),
    ...conversations.map((conversation) => conversation.seller_id).filter((value): value is string => !!value),
  ]));

  const [listingsResult, profilesResult] = await Promise.all([
    listingIds.length > 0 ? adminSupabase.from("listings").select("id, title").in("id", listingIds) : Promise.resolve({ data: [] as Partial<ListingRow>[] }),
    profileIds.length > 0 ? adminSupabase.from("profiles").select("id, full_name, business_name").in("id", profileIds) : Promise.resolve({ data: [] as any[] }),
  ]);

  const listingsMap = new Map((listingsResult.data || []).map((row: any) => [row.id, row.title || "Anuncio"]));
  const profilesMap = new Map((profilesResult.data || []).map((row: any) => [row.id, row.business_name || row.full_name || "Usuario"]));
  const pendingAgreements = agreements.filter((agreement) => agreement.status !== "confirmed" && agreement.status !== "cancelled");
  const confirmedAgreements = agreements.filter((agreement) => agreement.status === "confirmed" || agreement.confirmed_at);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Actividad</h1>
          <p className="text-muted-foreground">Seguimiento de conversaciones, propuestas, donaciones y acuerdos confirmados.</p>
        </div>
        <Button asChild variant="outline"><Link href="/account/listings">Volver a mis anuncios</Link></Button>
      </div>

      <ActivityNotificationsList initialNotifications={notifications} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Conversaciones</p><p className="mt-2 text-3xl font-bold">{conversations.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Acuerdos pendientes</p><p className="mt-2 text-3xl font-bold">{pendingAgreements.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Acuerdos confirmados</p><p className="mt-2 text-3xl font-bold">{confirmedAgreements.length}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Conversaciones recientes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {conversations.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has iniciado conversaciones.</p> : null}
            {conversations.map((conversation) => {
              const otherId = conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;
              return (
                <div key={conversation.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{listingsMap.get(conversation.listing_id || "") || "Anuncio"}</p>
                      <p className="text-sm text-muted-foreground">Con {profilesMap.get(otherId || "") || "Usuario"}</p>
                    </div>
                    <Button asChild size="sm" variant="outline"><Link href="/messages">Abrir chat</Link></Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Última actividad: {formatDate(conversation.updated_at || conversation.created_at)}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Acuerdos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {agreements.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has confirmado acuerdos.</p> : null}
            {agreements.map((agreement) => (
              <div key={agreement.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{listingsMap.get(agreement.listing_id || "") || "Anuncio"}</p>
                    {agreement.amount ? <p className="text-sm text-muted-foreground">Precio acordado: {formatPrice(agreement.amount)}</p> : <p className="text-sm text-muted-foreground">Donación o acuerdo sin precio</p>}
                  </div>
                  <Badge variant="outline" className={getStatusClass(agreement.status)}>{getStatusLabel(agreement.status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(agreement.confirmed_at || agreement.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Propuestas enviadas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sentOffers.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has enviado propuestas.</p> : null}
            {sentOffers.map((offer) => (
              <div key={offer.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{listingsMap.get(offer.listing_id) || "Anuncio"}</p>
                    <p className="text-sm text-muted-foreground">Vendedor: {profilesMap.get(offer.seller_id) || "Usuario"}</p>
                    <p className="text-sm text-muted-foreground">Importe: {formatPrice(resolveOfferAmount(offer))}</p>
                  </div>
                  <Badge variant="outline" className={getStatusClass(offer.status)}>{getStatusLabel(offer.status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(offer.responded_at || offer.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Propuestas recibidas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {receivedOffers.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has recibido propuestas.</p> : null}
            {receivedOffers.map((offer) => (
              <div key={offer.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{listingsMap.get(offer.listing_id) || "Anuncio"}</p>
                    <p className="text-sm text-muted-foreground">Comprador: {profilesMap.get(offer.buyer_id) || "Usuario"}</p>
                    <p className="text-sm text-muted-foreground">Importe: {formatPrice(resolveOfferAmount(offer))}</p>
                  </div>
                  <Badge variant="outline" className={getStatusClass(offer.status)}>{getStatusLabel(offer.status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(offer.responded_at || offer.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Donaciones solicitadas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sentDonations.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has solicitado donaciones.</p> : null}
            {sentDonations.map((request) => (
              <div key={request.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{listingsMap.get(request.listing_id || "") || "Anuncio"}</p>
                  <Badge variant="outline" className={getStatusClass(request.status)}>{getStatusLabel(request.status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(request.updated_at || request.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Donaciones recibidas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {receivedDonations.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has recibido solicitudes de donación.</p> : null}
            {receivedDonations.map((request) => (
              <div key={request.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{listingsMap.get(request.listing_id || "") || "Anuncio"}</p>
                  <Badge variant="outline" className={getStatusClass(request.status)}>{getStatusLabel(request.status)}</Badge>
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
