"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SimulateLabelButton({ shipmentId }: { shipmentId: string }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const simulate = async () => {
    setLoading(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/commerce-lab/simulate-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo simular la etiqueta.");
      }
      setStatus("Etiqueta sandbox lista. Actualiza la página.");
    } catch (error: any) {
      setStatus(error?.message || "No se pudo simular la etiqueta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 space-y-1">
      <Button type="button" size="sm" variant="outline" onClick={simulate} disabled={loading}>
        {loading ? "Simulando..." : "Simular etiqueta"}
      </Button>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}


export function ReleaseTransferButton({ paymentIntentId }: { paymentIntentId: string }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const release = async () => {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/commerce-lab/release-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo liberar la transferencia.");
      }
      setStatus(payload?.existing ? "Transferencia ya liberada." : "Transferencia test liberada.");
    } catch (error: any) {
      setStatus(error?.message || "No se pudo liberar la transferencia.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" onClick={release} disabled={loading}>
        {loading ? "Liberando..." : "Liberar fondos test"}
      </Button>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}

export function RefundPaymentButton({ paymentIntentId }: { paymentIntentId: string }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const refund = async () => {
    const confirmed = window.confirm(
      "Esto creará un refund Stripe test y, si ya hubo transferencia, intentará revertirla. ¿Continuar?"
    );
    if (!confirmed) return;

    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/commerce-lab/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo reembolsar.");
      }
      setStatus(payload?.existing ? "Refund ya registrado." : "Refund test creado.");
    } catch (error: any) {
      setStatus(error?.message || "No se pudo reembolsar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" variant="destructive" onClick={refund} disabled={loading}>
        {loading ? "Reembolsando..." : "Refund test"}
      </Button>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}
