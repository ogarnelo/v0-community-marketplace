"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ShipmentRow } from "@/lib/types/marketplace";

function getShipmentStatusLabel(status: string | null) {
  switch (status) {
    case "label_pending":
      return "Pendiente de etiqueta";
    case "ready_to_ship":
      return "Listo para enviar";
    case "in_transit":
      return "En tránsito";
    case "delivered":
      return "Entregado";
    case "cancelled":
      return "Cancelado";
    default:
      return status || "Preparando envío";
  }
}

function getShipmentStatusClass(status: string | null) {
  switch (status) {
    case "label_pending":
    case "ready_to_ship":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "in_transit":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "delivered":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "cancelled":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function ShipmentStatusCard({
  shipment,
  currentUserId,
  compact = false,
}: {
  shipment: ShipmentRow;
  currentUserId: string;
  compact?: boolean;
}) {
  const [trackingCode, setTrackingCode] = useState(shipment.tracking_code || "");
  const [trackingUrl, setTrackingUrl] = useState(shipment.tracking_url || "");
  const [loading, setLoading] = useState(false);

  const isSeller = currentUserId === shipment.seller_id;
  const isBuyer = currentUserId === shipment.buyer_id;
  const canMarkDispatched = isSeller && ["label_pending", "ready_to_ship", null].includes(shipment.status);
  const canMarkDelivered = isBuyer && shipment.status === "in_transit";

  const markDispatched = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/shipments/mark-dispatched", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: shipment.id,
          trackingCode: trackingCode.trim() || null,
          trackingUrl: trackingUrl.trim() || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo actualizar el envío.");
      }

      toast.success("Envío marcado como enviado.");
      window.location.reload();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo actualizar el envío.");
    } finally {
      setLoading(false);
    }
  };

  const markDelivered = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/shipments/mark-delivered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId: shipment.id }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo confirmar la entrega.");
      }

      toast.success("Entrega confirmada.");
      window.location.reload();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo confirmar la entrega.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-2xl border bg-white shadow-sm">
      <CardContent className={compact ? "space-y-3 p-4" : "space-y-4 p-5"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Estado del envío</p>
            <p className="text-sm text-slate-600">
              {shipment.provider === "sendcloud"
                ? "Gestionado con Sendcloud"
                : "Seguimiento preparado para logística"}
            </p>
          </div>
          <Badge variant="outline" className={getShipmentStatusClass(shipment.status)}>
            {getShipmentStatusLabel(shipment.status)}
          </Badge>
        </div>

        {shipment.label_url ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={shipment.label_url} target="_blank">
                Ver etiqueta
              </Link>
            </Button>
            {shipment.tracking_url ? (
              <Button asChild variant="outline" size="sm">
                <Link href={shipment.tracking_url} target="_blank">
                  Seguir envío
                </Link>
              </Button>
            ) : null}
          </div>
        ) : shipment.tracking_url ? (
          <Button asChild variant="outline" size="sm">
            <Link href={shipment.tracking_url} target="_blank">
              Seguir envío
            </Link>
          </Button>
        ) : null}

        {shipment.tracking_code ? (
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            Código de seguimiento: <span className="font-medium">{shipment.tracking_code}</span>
          </div>
        ) : null}

        {canMarkDispatched ? (
          <div className="space-y-3 rounded-xl bg-amber-50 p-3">
            <div className="text-sm text-amber-800">
              Si todavía no tienes agregador conectado, puedes marcarlo como enviado manualmente y añadir el seguimiento.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={trackingCode}
                onChange={(event) => setTrackingCode(event.target.value)}
                placeholder="Código de seguimiento (opcional)"
              />
              <Input
                value={trackingUrl}
                onChange={(event) => setTrackingUrl(event.target.value)}
                placeholder="URL de seguimiento (opcional)"
              />
            </div>
            <Button onClick={markDispatched} disabled={loading} className="bg-[#7EBA28] text-white hover:bg-[#6da122]">
              {loading ? "Guardando..." : "Marcar como enviado"}
            </Button>
          </div>
        ) : null}

        {canMarkDelivered ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3">
            <div className="text-sm text-emerald-800">
              Cuando lo hayas recibido correctamente, confirma la entrega para cerrar la operación.
            </div>
            <Button onClick={markDelivered} disabled={loading} className="bg-[#7EBA28] text-white hover:bg-[#6da122]">
              {loading ? "Confirmando..." : "Confirmar entrega"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
