"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ShipmentRow } from "@/lib/types/marketplace";
import { safeExternalUrl } from "@/lib/security/safe-url";

function getStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "label_created":
      return "Etiqueta creada";
    case "ready_to_ship":
      return "Lista para enviar";
    case "dispatched":
      return "Enviado";
    case "delivered":
      return "Entregado";
    case "cancelled":
      return "Cancelado";
    case "manual_pending":
      return "Pendiente de preparación";
    default:
      return status || "Pendiente";
  }
}

export function ShipmentStatusCard({
  shipment,
  canCreateLabel,
}: {
  shipment: ShipmentRow;
  canCreateLabel?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localShipment, setLocalShipment] = useState(shipment);

  const safeTrackingUrl = useMemo(
    () => safeExternalUrl(localShipment.tracking_url),
    [localShipment.tracking_url]
  );
  const safeLabelUrl = useMemo(
    () => safeExternalUrl(localShipment.label_url),
    [localShipment.label_url]
  );

  async function handleCreateLabel() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/shipments/create-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId: localShipment.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo crear la etiqueta.");
      }
      setLocalShipment((prev) => ({
        ...prev,
        status: data.shipment?.status ?? prev.status,
        provider_shipment_id: data.shipment?.provider_shipment_id ?? prev.provider_shipment_id,
        tracking_code: data.shipment?.tracking_code ?? prev.tracking_code,
        tracking_url: data.shipment?.tracking_url ?? prev.tracking_url,
        label_url: data.shipment?.label_url ?? prev.label_url,
      }));
    } catch (err: any) {
      setError(err?.message || "No se pudo crear la etiqueta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="rounded-2xl border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Estado del envío</CardTitle>
          <Badge variant="outline">{getStatusLabel(localShipment.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {localShipment.provider ? (
          <p className="text-muted-foreground">
            Proveedor: <span className="font-medium text-foreground">{localShipment.provider}</span>
          </p>
        ) : null}
        {localShipment.tracking_code ? (
          <p className="text-muted-foreground">
            Tracking: <span className="font-medium text-foreground">{localShipment.tracking_code}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {safeTrackingUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={safeTrackingUrl} target="_blank" rel="noopener noreferrer">
                Ver seguimiento
              </a>
            </Button>
          ) : null}
          {safeLabelUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={safeLabelUrl} target="_blank" rel="noopener noreferrer">
                Descargar etiqueta
              </a>
            </Button>
          ) : null}
          {canCreateLabel && !safeLabelUrl ? (
            <Button size="sm" onClick={handleCreateLabel} disabled={loading}>
              {loading ? "Creando..." : "Crear etiqueta"}
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {localShipment.provider === "manual" ? (
          <p className="text-xs text-muted-foreground">
            Este envío está en modo manual. Puedes mantenerlo así o activar Sendcloud para generar etiqueta y tracking automáticos.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
