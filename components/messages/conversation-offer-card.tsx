"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/marketplace/formatters";

type OfferStatus = "pending" | "countered" | "accepted" | "rejected" | "withdrawn" | string;

interface ConversationOfferCardProps {
  offerId: string;
  listingId: string;
  currentUserId: string;
  sellerId: string;
  buyerId: string;
  offeredPrice: number;
  counterPrice: number | null;
  status: OfferStatus;
}

function getBadgeVariant(status: OfferStatus) {
  switch (status) {
    case "accepted":
      return "default" as const;
    case "rejected":
      return "secondary" as const;
    case "countered":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

function getStatusLabel(status: OfferStatus) {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    case "countered":
      return "Contraoferta enviada";
    case "withdrawn":
      return "Retirada";
    default:
      return status || "Pendiente";
  }
}

export function ConversationOfferCard(props: ConversationOfferCardProps) {
  const {
    offerId,
    currentUserId,
    sellerId,
    offeredPrice,
    counterPrice,
    status,
  } = props;

  const isSeller = currentUserId === sellerId;
  const [loading, setLoading] = useState(false);
  const [counterValue, setCounterValue] = useState(
    counterPrice != null ? String(counterPrice) : String(offeredPrice)
  );

  const canRespond = isSeller && (status === "pending" || status === "countered");

  const submitAction = async (action: "accept" | "reject" | "counter") => {
    if (loading) return;

    setLoading(true);

    try {
      const response = await fetch("/api/offers/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId,
          action,
          counterPrice: action === "counter" ? counterValue : undefined,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo procesar la oferta.");
      }

      window.location.reload();
    } catch (error: any) {
      alert(error?.message || "No se pudo procesar la oferta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-4 border-dashed bg-amber-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Oferta en esta conversación</CardTitle>
          <Badge variant={getBadgeVariant(status)}>{getStatusLabel(status)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p>
            Oferta enviada: <span className="font-medium text-foreground">{formatPrice(offeredPrice)}</span>
          </p>
          {counterPrice != null ? (
            <p>
              Contraoferta actual: <span className="font-medium text-foreground">{formatPrice(counterPrice)}</span>
            </p>
          ) : null}
        </div>

        {canRespond ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="number"
                min="1"
                step="0.01"
                value={counterValue}
                onChange={(event) => setCounterValue(event.target.value)}
                placeholder="Contraoferta (€)"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => submitAction("counter")}
                disabled={loading}
              >
                Contraofertar
              </Button>
            </div>

            <div className="flex gap-2">
              <Button type="button" onClick={() => submitAction("accept")} disabled={loading}>
                Aceptar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => submitAction("reject")}
                disabled={loading}
              >
                Rechazar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isSeller
              ? "Esta oferta ya no admite más acciones desde el hilo."
              : "Sigue el estado de la oferta desde esta conversación en tiempo real."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
