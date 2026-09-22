"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ReleaseTransferButton({ paymentId }: { paymentId: string }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const release = async () => {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/commerce-lab/release-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo liberar la transferencia.");
      }
      setStatus(
        payload?.alreadyReleased
          ? "Transferencia ya liberada."
          : `Transferencia test liberada: ${payload.transferId}`
      );
    } catch (error: any) {
      setStatus(error?.message || "No se pudo liberar la transferencia.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 space-y-1">
      <Button type="button" size="sm" variant="outline" onClick={release} disabled={loading}>
        {loading ? "Liberando..." : "Liberar transferencia test"}
      </Button>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}
