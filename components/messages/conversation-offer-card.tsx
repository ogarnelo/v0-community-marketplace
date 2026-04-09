"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/marketplace/formatters";
import type { ListingOfferRow } from "@/lib/types/marketplace";
import type { OfferActorRole, OfferEventType, OfferRealtimeStatus } from "@/lib/offers/chat-message";

type ConversationOfferLike = Pick<
  ListingOfferRow,
  | "id"
  | "listing_id"
  | "buyer_id"
  | "seller_id"
  | "offered_price"
  | "current_amount"
  | "current_actor"
  | "rounds_count"
  | "accepted_amount"
  | "status"
  | "counter_price"
>;

interface ConversationOfferCardProps {
  offer: ConversationOfferLike;
  currentUserId: string;
  messageStatus: OfferRealtimeStatus;
  messageAmount: number;
  messageEventType: OfferEventType;
  messageActorRole: OfferActorRole;
  messageRound: number;
  isActionable: boolean;
}

function getOfferStatusLabel(status: string | null) {
  switch (status) {
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    case "countered":
      return "Contraoferta enviada";
    case "pending":
      return "Pendiente";
    case "withdrawn":
      return "Retirada";
    default:
      return status || "Pendiente";
  }
}

export function ConversationOfferCard({
  offer,
  currentUserId,
  messageStatus,
  messageAmount,
  messageEventType,
  messageActorRole,
  messageRound,
  isActionable,
}: ConversationOfferCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<null | "accept" | "reject" | "counter">(null);
  const [counterPrice, setCounterPrice] = useState(String(messageAmount || offer.current_amount || ""));
  const [localStatus, setLocalStatus] = useState<string | null>(offer.status);

  useEffect(() => {
    setLocalStatus(offer.status ?? messageStatus);
  }, [offer.status, messageStatus]);

  useEffect(() => {
    setCounterPrice(String(messageAmount || offer.current_amount || offer.counter_price || offer.offered_price || ""));
  }, [messageAmount, offer.current_amount, offer.counter_price, offer.offered_price]);

  const isSeller = !!offer.seller_id && currentUserId === offer.seller_id;
  const isBuyer = !!offer.buyer_id && currentUserId === offer.buyer_id;
  const currentTurn = offer.current_actor ?? (messageStatus === "countered" ? "buyer" : messageStatus === "pending" ? "seller" : "closed");
  const canSellerRespond = isActionable && isSeller && ["pending", "countered"].includes(localStatus || "") && currentTurn === "seller";
  const canBuyerRespond = isActionable && isBuyer && ["pending", "countered"].includes(localStatus || "") && currentTurn === "buyer";
  const canRespond = canSellerRespond || canBuyerRespond;
  const roundsCount = Math.max(1, Number(offer.rounds_count || messageRound || 1));
  const canCounterAgain = roundsCount < 10;

  const headline = useMemo(() => {
    switch (messageEventType) {
      case "counter_sent":
        return messageActorRole === "seller"
          ? `Contraoferta del vendedor: ${formatPrice(messageAmount)}`
          : `Nueva oferta del comprador: ${formatPrice(messageAmount)}`;
      case "accepted":
        return `Oferta aceptada: ${formatPrice(messageAmount)}`;
      case "rejected":
        return `Negociación cerrada en ${formatPrice(messageAmount)}`;
      default:
        return `Oferta: ${formatPrice(messageAmount)}`;
    }
  }, [messageAmount, messageEventType, messageActorRole]);

  const submitAction = async (action: "accept" | "reject" | "counter") => {
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

      setLocalStatus(
        action === "accept"
          ? "accepted"
          : action === "reject"
            ? "rejected"
            : canSellerRespond
              ? "countered"
              : "pending"
      );
    } catch (error: any) {
      alert(error?.message || "No se pudo responder a la oferta.");
    } finally {
      setLoading(null);
      router.refresh();
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Oferta en negociación</p>
          <p className="mt-1 text-sm font-semibold">{headline}</p>
          <p className="mt-1 text-xs text-slate-600">
            Estado actual: {getOfferStatusLabel(localStatus)} · Ronda {roundsCount}/10
          </p>
        </div>
      </div>

      {canRespond ? (
        <div className="mt-4 space-y-3">
          {canCounterAgain ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="number"
                min="1"
                step="0.01"
                placeholder="Nueva propuesta (€)"
                value={counterPrice}
                onChange={(event) => setCounterPrice(event.target.value)}
              />
              <Button type="button" variant="outline" onClick={() => submitAction("counter")} disabled={loading !== null}>
                {loading === "counter" ? "Enviando..." : "Contraofertar"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              Se ha alcanzado el máximo de 10 rondas. Solo puedes aceptar o rechazar esta negociación.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => submitAction("accept")} disabled={loading !== null}>
              {loading === "accept" ? "Aceptando..." : canSellerRespond ? "Aceptar" : "Aceptar contraoferta"}
            </Button>
            <Button type="button" variant="outline" onClick={() => submitAction("reject")} disabled={loading !== null}>
              {loading === "reject" ? "Rechazando..." : "Rechazar"}
            </Button>
          </div>
        </div>
      ) : null}

      {messageEventType === "rejected" ? (
        <p className="mt-3 text-xs text-slate-600">
          {messageActorRole === "seller"
            ? isSeller
              ? "Has cerrado esta negociación. El comprador tendrá que volver al anuncio para enviar una nueva oferta."
              : "El vendedor ha cerrado esta negociación. Puedes volver al anuncio y empezar una oferta nueva."
            : isBuyer
              ? "Has cerrado esta negociación. Si quieres volver a negociar, tendrás que regresar al anuncio y empezar una oferta nueva."
              : "El comprador ha cerrado esta negociación. Si quiere volver a negociar, tendrá que regresar al anuncio y empezar una oferta nueva."}
        </p>
      ) : null}

      {messageEventType === "accepted" ? (
        <p className="mt-3 text-xs text-slate-600">
          La negociación ha terminado con acuerdo. Podéis seguir usando este chat para resolver dudas, concretar la entrega o gestionar el envío.
        </p>
      ) : null}

      {offer.listing_id ? (
        <div className="mt-3">
          <Button asChild size="sm" variant="ghost" className="px-0 text-slate-700 hover:text-slate-900">
            <Link href={`/marketplace/listing/${offer.listing_id}`}>Abrir anuncio</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
