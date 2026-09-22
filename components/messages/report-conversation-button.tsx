"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Flag, Loader2 } from "lucide-react";

type ReportConversationButtonProps = {
  conversationId: string;
  iconOnly?: boolean;
};

export function ReportConversationButton({
  conversationId,
  iconOnly = false,
}: ReportConversationButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage("");

    if (!reason) {
      setErrorMessage("Debes seleccionar un motivo.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "conversation",
          targetId: conversationId,
          reason,
          details,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.assign("/auth?next=/messages");
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo enviar el reporte.");
      }

      setSubmitted(true);
    } catch (error: any) {
      console.error("Error reportando conversación:", error);
      setErrorMessage(
        error?.message ||
        error?.details ||
        "No se pudo enviar el reporte."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setTimeout(() => {
        setSubmitted(false);
        setReason("");
        setDetails("");
        setErrorMessage("");
        setLoading(false);
      }, 150);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={iconOnly ? "icon" : "sm"}
          className={iconOnly ? "h-9 w-9" : "gap-2"}
          aria-label="Reportar chat"
          title="Reportar chat"
        >
          <Flag className="h-4 w-4" />
          {!iconOnly ? "Reportar chat" : null}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar chat</DialogTitle>
          <DialogDescription>
            Registra un reporte para que el equipo de moderación pueda revisarlo.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Reporte enviado correctamente.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Motivo *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="fraude">Fraude o estafa</SelectItem>
                  <SelectItem value="acoso">Acoso o trato inapropiado</SelectItem>
                  <SelectItem value="contenido_inapropiado">
                    Contenido inapropiado
                  </SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="report-details">Detalles</Label>
              <Textarea
                id="report-details"
                rows={4}
                placeholder="Cuéntanos qué ha ocurrido..."
                value={details}
                maxLength={1000}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>

            {errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {!submitted ? (
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar reporte
            </Button>
          ) : (
            <Button type="button" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}