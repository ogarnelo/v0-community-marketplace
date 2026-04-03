import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, MessageCircle, Tags, Gift, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppNotificationRow } from "@/lib/notifications";
import type { DonationRequestRow, ListingOfferRow } from "@/lib/types/marketplace";
import { formatPrice } from "@/lib/marketplace/formatters";

type ActivityOfferRow = ListingOfferRow & {
  listings?: { title: string | null } | null;
};

type ActivityDonationRow = DonationRequestRow & {
  listings?: { title: string | null } | null;
};

function getNotificationBadgeVariant(readAt: string | null) {
  return readAt ? "outline" : "default";
}

export default async function AccountActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const [{ data: notifications }, { data: offersSent }, { data: offersReceived }, { data: donations }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, user_id, kind, title, body, href, metadata, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("listing_offers")
      .select("id, listing_id, buyer_id, seller_id, offered_price, status, counter_price, created_at, responded_at, listings(title)")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("listing_offers")
      .select("id, listing_id, buyer_id, seller_id, offered_price, status, counter_price, created_at, responded_at, listings(title)")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("donation_requests")
      .select("id, listing_id, requester_id, assigned_to_requester_id, approved_by_admin_id, status, note, created_at, updated_at, school_id, listings(title)")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Actividad</h1>
          <p className="mt-2 text-muted-foreground">
            Sigue tus notificaciones, ofertas y solicitudes recientes desde un solo sitio.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/account">Volver a mi cuenta</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones recientes
            </CardTitle>
            <CardDescription>Eventos clave del marketplace y tus operaciones.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {((notifications || []) as AppNotificationRow[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no tienes notificaciones.</p>
            ) : (
              ((notifications || []) as AppNotificationRow[]).map((notification) => (
                <div key={notification.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{notification.title}</p>
                      {notification.body ? (
                        <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(notification.created_at).toLocaleString("es-ES")}
                      </p>
                    </div>
                    <Badge variant={getNotificationBadgeVariant(notification.read_at)}>
                      {notification.read_at ? "Leída" : "Nueva"}
                    </Badge>
                  </div>
                  {notification.href ? (
                    <div className="mt-3">
                      <Button asChild variant="ghost" size="sm" className="gap-2 px-0">
                        <Link href={notification.href}>
                          Ir al detalle
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tags className="h-5 w-5" />
                Ofertas que has enviado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {((offersSent || []) as ActivityOfferRow[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no has enviado ofertas.</p>
              ) : (
                ((offersSent || []) as ActivityOfferRow[]).map((offer) => (
                  <div key={offer.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{offer.listings?.title || "Anuncio"}</p>
                    <p className="mt-1 text-muted-foreground">{formatPrice(offer.offered_price)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Estado: {offer.status || "pending"}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageCircle className="h-5 w-5" />
                Ofertas recibidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {((offersReceived || []) as ActivityOfferRow[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no has recibido ofertas.</p>
              ) : (
                ((offersReceived || []) as ActivityOfferRow[]).map((offer) => (
                  <div key={offer.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{offer.listings?.title || "Anuncio"}</p>
                    <p className="mt-1 text-muted-foreground">{formatPrice(offer.offered_price)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Estado: {offer.status || "pending"}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gift className="h-5 w-5" />
                Solicitudes de donación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {((donations || []) as ActivityDonationRow[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no has solicitado donaciones.</p>
              ) : (
                ((donations || []) as ActivityDonationRow[]).map((request) => (
                  <div key={request.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{request.listings?.title || "Donación"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Estado: {request.status || "pending"}</p>
                    {request.note ? (
                      <p className="mt-1 text-xs text-muted-foreground">Nota: {request.note}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
