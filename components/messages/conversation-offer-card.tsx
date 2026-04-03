"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/marketplace/formatters";

type OfferStatus = "pending" | "accepted" | "rejected" | "countered" | "withdrawn";

export interface ConversationOfferCardData {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  offeredPrice: number;
  counterPrice: number | null;
  status: OfferStatus | string | null;
  createdAt: string | null;
}

interface ConversationOfferCardProps {
  offer: ConversationOfferCardData;
  currentUserId: string;
}

function getOfferStatusLabel(status: string | null) {
  switch (status) {
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    case "countered":
      return "Contraoferta enviada";
    case "withdrawn":
      return "Retirada";
    default:
      return "Pendiente";
  }
}

export function ConversationOfferCard({ offer, currentUserId }: ConversationOfferCardProps) {
  const router = useRouter();
  const [counterPrice, setCounterPrice] = useState(
    offer.counterPrice != null ? String(offer.counterPrice) : ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSeller = currentUserId === offer.sellerId;
  const effectivePrice = offer.counterPrice ?? offer.offeredPrice;
  const canRespond = isSeller && (offer.status === "pending" || offer.status === "countered");

  const summary = useMemo(() => {
    if (offer.status === "countered" && offer.counterPrice != null) {
      return `Contraoferta actual: ${formatPrice(offer.counterPrice)}`;
    }

    return `Oferta actual: ${formatPrice(effectivePrice)}`;
  }, [effectivePrice, offer.counterPrice, offer.status]);

  const submitAction = async (action: "accept" | "reject" | "counter") => {
    if (isSubmitting) return;

    setIsSubmitting(true);
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
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mb-4 border-dashed bg-muted/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Oferta vinculada al anuncio</CardTitle>
          <Badge variant="outline">{getOfferStatusLabel(offer.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">{summary}</p>
          <p className="text-xs text-muted-foreground">
            Creada {offer.createdAt ? new Date(offer.createdAt).toLocaleString("es-ES") : "recientemente"}
          </p>
        </div>

        {canRespond ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="number"
                min="1"
                step="0.01"
                value={counterPrice}
                onChange={(event) => setCounterPrice(event.target.value)}
                placeholder="Contraoferta (€)"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => submitAction("counter")}
                disabled={isSubmitting}
              >
                Contraofertar
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => submitAction("accept")} disabled={isSubmitting}>
                Aceptar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => submitAction("reject")}
                disabled={isSubmitting}
              >
                Rechazar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isSeller
              ? "Esta oferta ya fue gestionada."
              : "El vendedor gestionará la oferta desde este hilo."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
