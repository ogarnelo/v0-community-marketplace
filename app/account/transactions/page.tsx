import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import TransactionVelocityActionCard from "@/components/transaction/transaction-velocity-action-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Handshake, MessageCircle, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Operaciones | Wetudy",
  robots: {
    index: false,
    follow: false,
  },
};

function statusLabel(status: string | null) {
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
    default:
      return status || "Sin estado";
  }
}

export default async function AccountTransactionsPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/transactions");

  const admin = createAdminClient();

  const [{ data: actions }, { data: sentOffers }, { data: receivedOffers }] = await Promise.all([
    admin
      .from("transaction_velocity_events")
      .select("id, title, message, priority, href, action_label, created_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("listing_offers")
      .select("id, listing_id, buyer_id, seller_id, offered_price, counter_price, status, created_at, responded_at")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("listing_offers")
      .select("id, listing_id, buyer_id, seller_id, offered_price, counter_price, status, created_at, responded_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const allOffers = [...(sentOffers || []), ...(receivedOffers || [])];
  const listingIds = [...new Set(allOffers.map((offer: any) => offer.listing_id).filter(Boolean))];

  const { data: listings } = listingIds.length > 0
    ? await admin.from("listings").select("id, title").in("id", listingIds)
    : { data: [] as any[] };

  const listingMap = new Map((listings || []).map((listing: any) => [listing.id, listing]));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">
        <section className="mb-8 rounded-3xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Handshake className="h-6 w-6 text-primary" />
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight">Operaciones</h1>
              <p className="mt-2 max-w-3xl text-muted-foreground">
                Acciones rápidas para cerrar compras, responder ofertas y convertir conversaciones en operaciones reales. En móvil verás primero lo urgente.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/messages">Mensajes</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/account/activity">Actividad</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Acciones recomendadas</h2>
          </div>

          <div className="grid gap-4">
            {(actions || []).map((action: any) => (
              <TransactionVelocityActionCard key={action.id} action={action} />
            ))}

            {(actions || []).length === 0 ? (
              <div className="rounded-3xl border border-dashed bg-card p-8 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-primary" />
                <h3 className="mt-4 text-xl font-semibold">No hay acciones pendientes</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Cuando haya ofertas, contraofertas o pagos pendientes, Wetudy los priorizará aquí.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Ofertas enviadas</h2>
            </div>

            <div className="grid gap-3">
              {(sentOffers || []).map((offer: any) => {
                const listing = listingMap.get(offer.listing_id);
                return (
                  <article key={offer.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{listing?.title || "Anuncio"}</h3>
                        <p className="text-sm text-muted-foreground">
                          Oferta: {Number(offer.counter_price || offer.offered_price || 0).toFixed(2)}€
                        </p>
                      </div>
                      <Badge variant="outline">{statusLabel(offer.status)}</Badge>
                    </div>

                    {offer.status === "accepted" ? (
                      <Button asChild size="sm" className="mt-3">
                        <Link href={`/checkout/${offer.id}`}>Pagar</Link>
                      </Button>
                    ) : null}
                  </article>
                );
              })}

              {(sentOffers || []).length === 0 ? (
                <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No has enviado ofertas todavía.</p>
              ) : null}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Ofertas recibidas</h2>
            </div>

            <div className="grid gap-3">
              {(receivedOffers || []).map((offer: any) => {
                const listing = listingMap.get(offer.listing_id);
                return (
                  <article key={offer.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{listing?.title || "Anuncio"}</h3>
                        <p className="text-sm text-muted-foreground">
                          Oferta: {Number(offer.counter_price || offer.offered_price || 0).toFixed(2)}€
                        </p>
                      </div>
                      <Badge variant="outline">{statusLabel(offer.status)}</Badge>
                    </div>

                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <Link href="/account/activity">Responder</Link>
                    </Button>
                  </article>
                );
              })}

              {(receivedOffers || []).length === 0 ? (
                <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No has recibido ofertas todavía.</p>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
