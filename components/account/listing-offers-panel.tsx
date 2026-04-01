"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/marketplace/formatters";

export type SellerOfferItem = {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  offeredPrice: number;
  status: string | null;
  counterPrice: number | null;
  createdAt: string | null;
};

interface ListingOffersPanelProps {
  listingId: string;
  offers: SellerOfferItem[];
}

export function ListingOffersPanel({ listingId, offers }: ListingOffersPanelProps) {
  const [loadingOfferId, setLoadingOfferId] = useState<string | null>(null);
  const [counterValues, setCounterValues] = useState<Record<string, string>>({});

  const activeOffers = useMemo(
    () => offers.filter((offer) => offer.listingId === listingId),
    [listingId, offers]
  );

  if (activeOffers.length === 0) {
    return null;
  }

  const submitAction = async (offerId: string, action: "accept" | "reject" | "counter") => {
    if (loadingOfferId) return;

    setLoadingOfferId(offerId);

    try {
      const response = await fetch("/api/offers/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId,
          action,
          counterPrice: action === "counter" ? counterValues[offerId] : undefined,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo procesar la oferta.");
      }

      if (payload?.conversationId) {
        window.location.assign(`/messages/${payload.conversationId}`);
        return;
      }

      window.location.reload();
    } catch (error: any) {
      alert(error?.message || "No se pudo procesar la oferta.");
    } finally {
      setLoadingOfferId(null);
    }
  };

  return (
    <Card className="mt-4 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ofertas recibidas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeOffers.map((offer) => (
          <div key={offer.id} className="rounded-lg border p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{offer.buyerName}</p>
                <p className="text-sm text-muted-foreground">
                  Oferta: {formatPrice(offer.offeredPrice)}
                  {offer.counterPrice != null ? ` · Contraoferta: ${formatPrice(offer.counterPrice)}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">Estado: {offer.status || "pending"}</p>
              </div>
            </div>

            {(offer.status === "pending" || offer.status === "countered") && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="Contraoferta (€)"
                    value={counterValues[offer.id] || ""}
                    onChange={(event) =>
                      setCounterValues((prev) => ({ ...prev, [offer.id]: event.target.value }))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => submitAction(offer.id, "counter")}
                    disabled={loadingOfferId === offer.id}
                  >
                    Contraofertar
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => submitAction(offer.id, "accept")}
                    disabled={loadingOfferId === offer.id}
                  >
                    Aceptar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => submitAction(offer.id, "reject")}
                    disabled={loadingOfferId === offer.id}
                  >
                    Rechazar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
