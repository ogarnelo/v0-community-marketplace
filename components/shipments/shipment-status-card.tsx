"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ShipmentRow } from "@/lib/types/marketplace";

function getStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "draft":
      return "Pendiente de preparación";
    case "quoted":
      return "Envío calculado";
    case "label_pending":
      return "Etiqueta pendiente";
    case "label_ready":
      return "Etiqueta lista";
    case "in_transit":
      return "En tránsito";
    case "delivered":
      return "Entregado";
    case "failed":
      return "Error en el envío";
    case "cancelled":
      return "Cancelado";
    default:
      return status || "Pendiente";
  }
}

export function ShipmentStatusCard({
  shipment,
  canCreateLabel,
  currentUserId,
  compact = false,
}: {
  shipment: ShipmentRow;
  canCreateLabel?: boolean;
  currentUserId?: string;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localShipment, setLocalShipment] = useState(shipment);
  const isSeller = Boolean(currentUserId && localShipment.seller_id === currentUserId);
  const isBuyer = Boolean(currentUserId && localShipment.buyer_id === currentUserId);
  const canRequestLabel =
    Boolean(canCreateLabel ?? isSeller) &&
    !localShipment.label_url &&
    ["draft", "quoted", "label_pending"].includes(String(localShipment.status));
  const canMarkDispatched = isSeller && localShipment.status === "label_ready";
  const canConfirmDelivered = isBuyer && localShipment.status === "in_transit";

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

  async function runStateAction(endpoint: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: localShipment.id,
          ...(endpoint.includes("mark-dispatched")
            ? { trackingCode: localShipment.tracking_code || undefined }
            : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "No se pudo actualizar el envío.");

      setLocalShipment((prev) => ({
        ...prev,
        status: endpoint.includes("mark-delivered") ? "delivered" : "in_transit",
      }));
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar el envío.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={`rounded-2xl border ${compact ? "shadow-none" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Estado del envío</CardTitle>
          <Badge variant="outline">{getStatusLabel(localShipment.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {localShipment.provider ? (
          <p className="text-muted-foreground">Proveedor: <span className="font-medium text-foreground">{localShipment.provider}</span></p>
        ) : null}
        {localShipment.tracking_code ? (
          <p className="text-muted-foreground">Tracking: <span className="font-medium text-foreground">{localShipment.tracking_code}</span></p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {localShipment.tracking_url ? (
            <Button asChild size="sm" variant="outline">
              <a href={localShipment.tracking_url} target="_blank" rel="noreferrer">Ver seguimiento</a>
            </Button>
          ) : null}
          {localShipment.label_url ? (
            <Button asChild size="sm" variant="outline">
              <a href={localShipment.label_url} target="_blank" rel="noreferrer">Descargar etiqueta</a>
            </Button>
          ) : null}
          {canRequestLabel ? (
            <Button size="sm" onClick={handleCreateLabel} disabled={loading}>
              {loading ? "Creando..." : "Crear etiqueta"}
            </Button>
          ) : null}
          {canMarkDispatched ? (
            <Button
              size="sm"
              onClick={() => runStateAction("/api/shipments/mark-dispatched")}
              disabled={loading}
            >
              {loading ? "Actualizando..." : "Marcar como enviado"}
            </Button>
          ) : null}
          {canConfirmDelivered ? (
            <Button
              size="sm"
              onClick={() => runStateAction("/api/shipments/mark-delivered")}
              disabled={loading}
            >
              {loading ? "Actualizando..." : "Confirmar entrega"}
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
