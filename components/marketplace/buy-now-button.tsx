"use client";

import { useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildMarketplacePricing,
  type DeliveryMethod,
  type ShipmentTier,
} from "@/lib/payments/pricing";

interface BuyNowButtonProps {
  listingId: string;
  currentPrice?: number | null;
}

export function BuyNowButton({ listingId, currentPrice }: BuyNowButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("in_person");
  const [shipmentTier, setShipmentTier] = useState<ShipmentTier>("small");

  const pricing = useMemo(() => {
    return buildMarketplacePricing({
      itemAmount: Number(currentPrice || 0),
      deliveryMethod,
      shipmentTier: deliveryMethod === "shipping" ? shipmentTier : "none",
    });
  }, [currentPrice, deliveryMethod, shipmentTier]);

  const goTo = (payload: any) => {
    if (payload?.redirectTo) {
      window.location.assign(payload.redirectTo);
      return;
    }
    if (payload?.offerId) {
      window.location.assign(`/checkout/${payload.offerId}`);
      return;
    }
    if (payload?.conversationId) {
      window.location.assign(`/messages/${payload.conversationId}`);
      return;
    }
    window.location.assign("/messages");
  };

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const response = await fetch("/api/offers/buy-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          deliveryMethod,
          shipmentTier: deliveryMethod === "shipping" ? shipmentTier : "none",
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        if (payload?.redirectTo || payload?.conversationId || payload?.offerId) {
          goTo(payload);
          return;
        }
        throw new Error(payload?.error || "No se pudo iniciar la compra.");
      }

      setOpen(false);
      goTo(payload);
    } catch (error: any) {
      alert(error?.message || "No se pudo iniciar la compra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full gap-2" disabled={!currentPrice}>
          <ShoppingBag className="h-4 w-4" />
          Comprar ahora
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Comprar ahora</DialogTitle>
          <DialogDescription>
            Se preparará el pago seguro dentro de Wetudy. Si ya tienes una conversación abierta, te llevaremos al lugar correcto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Método de entrega</Label>
            <Select value={deliveryMethod} onValueChange={(value) => setDeliveryMethod(value as DeliveryMethod)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona cómo quieres recibirlo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">Entrega en mano</SelectItem>
                <SelectItem value="shipping">Envío</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {deliveryMethod === "shipping" ? (
            <div className="space-y-2">
              <Label>Tamaño del envío</Label>
              <Select value={shipmentTier} onValueChange={(value) => setShipmentTier(value as ShipmentTier)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tamaño" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Pequeño</SelectItem>
                  <SelectItem value="medium">Mediano</SelectItem>
                  <SelectItem value="large">Grande</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="rounded-2xl border bg-muted/40 p-4 text-sm">
            <div className="flex items-center justify-between gap-3"><span>Artículo</span><span className="font-medium">{pricing.itemAmount.toFixed(2)} €</span></div>
            <div className="mt-2 flex items-center justify-between gap-3"><span>Envío</span><span className="font-medium">{pricing.shippingAmount.toFixed(2)} €</span></div>
            <div className="mt-2 flex items-center justify-between gap-3"><span>Protección Wetudy</span><span className="font-medium">{pricing.buyerFeeAmount.toFixed(2)} €</span></div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-base font-semibold"><span>Total comprador</span><span>{pricing.totalBuyerAmount.toFixed(2)} €</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="button" onClick={handleSubmit} disabled={loading || !currentPrice}>{loading ? "Preparando..." : "Continuar al pago"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
