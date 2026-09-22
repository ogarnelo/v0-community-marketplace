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
