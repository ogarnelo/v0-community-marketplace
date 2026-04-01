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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RequestDonationButtonProps {
  listingId: string;
}

export function RequestDonationButton({ listingId }: RequestDonationButtonProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const response = await fetch("/api/donations/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, note }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo solicitar la donación.");
      }

      alert("Solicitud enviada. También se ha abierto el chat con el propietario.");
      setOpen(false);

      if (payload?.conversationId) {
        window.location.assign(`/messages/${payload.conversationId}`);
      }
    } catch (error: any) {
      alert(error?.message || "No se pudo solicitar la donación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline" className="mt-3 w-full">
          Solicitar donación
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar donación</DialogTitle>
          <DialogDescription>
            El centro revisará la solicitud. También se abrirá un chat con el propietario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="donationNote">Mensaje para el centro o el propietario</Label>
          <Textarea
            id="donationNote"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Cuéntanos por qué te interesa esta donación..."
            rows={4}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? "Enviando..." : "Enviar solicitud"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
