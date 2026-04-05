"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { DonationRequestRow } from "@/lib/types/marketplace";

interface ConversationDonationCardProps {
  request: DonationRequestRow;
  canRespond: boolean;
}

function getStatusLabel(status: string | null) {
  switch (status) {
    case "approved":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    case "completed":
      return "Completada";
    case "cancelled":
      return "Cancelada";
    default:
      return "Pendiente";
  }
}

export function ConversationDonationCard({ request, canRespond }: ConversationDonationCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<null | "accept" | "reject">(null);
  const [localStatus, setLocalStatus] = useState<string | null>(request.status);

  const submitAction = async (action: "accept" | "reject") => {
    if (loading) return;
    setLoading(action);

    try {
      const response = await fetch("/api/donations/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id, action }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo responder a la solicitud.");
      }

      setLocalStatus(action === "accept" ? "approved" : "rejected");
      router.refresh();
    } catch (error: any) {
      alert(error?.message || "No se pudo responder a la solicitud.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Solicitud de donación
      </p>
      <p className="mt-1 text-sm text-slate-700">
        Estado: <span className="font-semibold">{getStatusLabel(localStatus)}</span>
      </p>
      {request.note ? <p className="mt-2 text-sm text-slate-600">Nota: {request.note}</p> : null}

      {canRespond && localStatus === "pending" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => submitAction("accept")} disabled={loading !== null}>
            {loading === "accept" ? "Aceptando..." : "Aceptar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => submitAction("reject")}
            disabled={loading !== null}
          >
            {loading === "reject" ? "Rechazando..." : "Rechazar"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
