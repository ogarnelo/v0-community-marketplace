"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/marketplace/formatters";
import type { ListingOfferRow } from "@/lib/types/marketplace";
import type { OfferActorRole, OfferEventType } from "@/lib/offers/chat-message";

type OfferLike = Pick<
  ListingOfferRow,
  | "id"
  | "listing_id"
  | "buyer_id"
  | "seller_id"
  | "offered_price"
  | "current_amount"
  | "current_actor"
  | "rounds_count"
  | "status"
  | "counter_price"
>;

interface ConversationOfferCardProps {
  offer: OfferLike;
  currentUserId: string;
  eventId: string;
  latestEventId: string | null;
  eventType: OfferEventType;
  actorRole: OfferActorRole;
  amount: number;
  round: number;
}

function getStatusLabel(status: string | null) {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "countered":
      return "En negociación";
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    case "withdrawn":
      return "Retirada";
    default:
      return status || "Pendiente";
  }
}

export function ConversationOfferCard({
  offer,
  currentUserId,
  eventId,
  latestEventId,
  eventType,
  actorRole,
  amount,
  round,
}: ConversationOfferCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<null | "accept" | "reject" | "counter">(null);
  const [counterPrice, setCounterPrice] = useState(String(offer.current_amount ?? amount ?? offer.offered_price));

  const isBuyer = currentUserId === offer.buyer_id;
  const isSeller = currentUserId === offer.seller_id;
  const currentActor = offer.current_actor === "buyer" || offer.current_actor === "seller" ? offer.current_actor : null;
  const roundsCount = offer.rounds_count ?? 1;
  const isLatestEvent = !latestEventId || latestEventId === eventId;
  const isOpen = offer.status === "pending" || offer.status === "countered";
  const canAct = isLatestEvent && isOpen && ((currentActor === "buyer" && isBuyer) || (currentActor === "seller" && isSeller));
  const canCounter = canAct && roundsCount < 10;

  const title = useMemo(() => {
    if (eventType === "offer_created") {
      return actorRole === "buyer" ? "Oferta enviada" : "Oferta inicial";
    }

    if (eventType === "counter_sent") {
      return actorRole === "seller" ? "Contraoferta del vendedor" : "Nueva propuesta del comprador";
    }

    if (eventType === "accepted") return "Oferta aceptada";
    if (eventType === "rejected") return "Oferta rechazada";
    return "Oferta";
  }, [actorRole, eventType]);

  const description = useMemo(() => {
    if (eventType === "accepted") {
      return `Se ha aceptado ${formatPrice(amount)}.`;
    }

    if (eventType === "rejected") {
      return isBuyer
        ? "El vendedor ha cerrado esta negociación. Puedes volver al anuncio y empezar una oferta nueva."
        : "Has cerrado esta negociación. El comprador tendrá que volver al anuncio para enviar una nueva oferta.";
    }

    if (!canAct) {
      if (offer.status === "accepted") return "Esta negociación ya ha terminado.";
      if (offer.status === "rejected") return "Esta negociación está cerrada.";
      return currentActor === "buyer"
        ? "Esperando respuesta del comprador."
        : "Esperando respuesta del vendedor.";
    }

    return currentActor === "buyer"
      ? "Es tu turno. Puedes aceptar, rechazar o enviar una nueva contraoferta."
      : "Es tu turno. Puedes aceptar, rechazar o enviar una contraoferta.";
  }, [amount, canAct, currentActor, eventType, isBuyer, offer.status]);

  async function submitAction(action: "accept" | "reject" | "counter") {
    if (loading) return;
    setLoading(action);

    try {
      const response = await fetch("/api/offers/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: offer.id,
          action,
          counterPrice: action === "counter" ? counterPrice : undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo responder a la oferta.");
      }

      router.refresh();
    } catch (error: any) {
      alert(error?.message || "No se pudo responder a la oferta.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{title}</p>
      <p className="mt-2 text-base font-semibold">{formatPrice(amount)}</p>
      <p className="mt-1 text-xs text-slate-600">Estado: {getStatusLabel(offer.status)}</p>
      <p className="mt-1 text-xs text-slate-500">Ronda {round}</p>
      <p className="mt-3 text-sm text-slate-700">{description}</p>

      {canAct ? (
        <div className="mt-4 space-y-3">
          {canCounter ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="number"
                min="0.5"
                step="0.01"
                value={counterPrice}
                onChange={(event) => setCounterPrice(event.target.value)}
                placeholder="Nuevo importe (€)"
              />
              <Button type="button" variant="outline" onClick={() => submitAction("counter")} disabled={loading !== null}>
                {loading === "counter" ? "Enviando..." : isBuyer ? "Hacer contraoferta" : "Contraofertar"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Se ha alcanzado el máximo de 10 rondas de negociación.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => submitAction("accept")} disabled={loading !== null}>
              {loading === "accept" ? "Aceptando..." : "Aceptar"}
            </Button>
            <Button type="button" variant="outline" onClick={() => submitAction("reject")} disabled={loading !== null}>
              {loading === "reject" ? "Rechazando..." : "Rechazar"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
