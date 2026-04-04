"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MakeOfferButtonProps {
  listingId: string;
  currentPrice?: number | null;
}

export function MakeOfferButton({ listingId, currentPrice }: MakeOfferButtonProps) {
  const [open, setOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState(
    typeof currentPrice === "number" ? String(currentPrice) : ""
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const response = await fetch("/api/offers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, offeredPrice: offerPrice }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo enviar la oferta.");
      }

      setOpen(false);

      if (payload?.conversationId) {
        window.location.assign(`/messages/${payload.conversationId}`);
        return;
      }

      alert("Oferta enviada correctamente.");
    } catch (error: any) {
      alert(error?.message || "No se pudo enviar la oferta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline" className="mt-3 w-full">
          Hacer oferta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar oferta</DialogTitle>
          <DialogDescription>
            El vendedor podrá aceptarla, rechazarla o proponerte otro precio. Se abrirá el chat automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="offerPrice">Tu oferta (€)</Label>
          <Input
            id="offerPrice"
            type="number"
            min="1"
            step="0.01"
            value={offerPrice}
            onChange={(event) => setOfferPrice(event.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? "Enviando..." : "Enviar oferta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
