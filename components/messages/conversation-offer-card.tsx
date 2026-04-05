"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/marketplace/formatters";
import type { ListingOfferRow } from "@/lib/types/marketplace";

type ConversationOfferLike = Pick<
  ListingOfferRow,
  "id" | "listing_id" | "buyer_id" | "seller_id" | "offered_price" | "status" | "counter_price"
>;

interface ConversationOfferCardProps {
  offer: ConversationOfferLike;
  currentUserId: string;
  canRespond?: boolean;
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

export function ConversationOfferCard({ offer, currentUserId, canRespond: canRespondOverride }: ConversationOfferCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<null | "accept" | "reject" | "counter">(null);
  const [counterPrice, setCounterPrice] = useState(
    offer.counter_price != null ? String(offer.counter_price) : ""
  );
  const [localStatus, setLocalStatus] = useState<string | null>(offer.status);

  const isSeller = !!offer.seller_id && currentUserId === offer.seller_id;
  const canRespond = (typeof canRespondOverride === "boolean" ? canRespondOverride : isSeller) && (localStatus === "pending" || localStatus === "countered");

  const headline = useMemo(() => {
    if (localStatus === "countered" && offer.counter_price != null) {
      return `Contraoferta: ${formatPrice(offer.counter_price)}`;
    }

    return `Oferta: ${formatPrice(offer.offered_price)}`;
  }, [localStatus, offer.counter_price, offer.offered_price]);

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
        action === "accept" ? "accepted" : action === "reject" ? "rejected" : "countered"
      );
      router.refresh();
    } catch (error: any) {
      alert(error?.message || "No se pudo responder a la oferta.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Oferta en negociación
          </p>
          <p className="mt-1 text-sm font-semibold">{headline}</p>
          <p className="mt-1 text-xs text-slate-600">Estado: {getOfferStatusLabel(localStatus)}</p>
        </div>
      </div>

      {canRespond ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="number"
              min="1"
              step="0.01"
              placeholder="Contraoferta (€)"
              value={counterPrice}
              onChange={(event) => setCounterPrice(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => submitAction("counter")}
              disabled={loading !== null}
            >
              {loading === "counter" ? "Enviando..." : "Contraofertar"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => submitAction("accept")} disabled={loading !== null}>
              {loading === "accept" ? "Aceptando..." : "Aceptar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => submitAction("reject")}
              disabled={loading !== null}
            >
              {loading === "reject" ? "Rechazando..." : "Rechazar"}
            </Button>
          </div>
        </div>
      ) : null}

      {!isSeller && localStatus === "rejected" ? (
        <p className="mt-3 text-xs text-slate-600">
          El vendedor ha rechazado esta oferta. Puedes enviar una nueva desde el anuncio.
        </p>
      ) : null}

      {!isSeller && localStatus === "countered" ? (
        <p className="mt-3 text-xs text-slate-600">
          El vendedor te ha propuesto otro precio. Puedes seguir negociando por chat o volver al anuncio para enviar una nueva oferta.
        </p>
      ) : null}

      {!isSeller && offer.listing_id ? (
        <div className="mt-3">
          <Button asChild size="sm" variant="ghost" className="px-0 text-slate-700 hover:text-slate-900">
            <Link href={`/marketplace/listing/${offer.listing_id}`}>Abrir anuncio</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
