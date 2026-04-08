"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { DonationRequestRow } from "@/lib/types/marketplace";
import type { DonationEventType } from "@/lib/donations/chat-message";

interface ConversationDonationCardProps {
  request: DonationRequestRow;
  currentUserId: string;
  ownerUserId: string;
  eventId: string;
  latestEventId: string | null;
  eventType: DonationEventType;
  note: string;
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

export function ConversationDonationCard({
  request,
  currentUserId,
  ownerUserId,
  eventId,
  latestEventId,
  eventType,
  note,
}: ConversationDonationCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<null | "accept" | "reject">(null);

  const isOwner = currentUserId === ownerUserId;
  const isLatestEvent = !latestEventId || latestEventId === eventId;
  const canRespond = isOwner && isLatestEvent && request.status === "pending";

  const title =
    eventType === "approved"
      ? "Donación aceptada"
      : eventType === "rejected"
        ? "Donación rechazada"
        : "Solicitud de donación";

  async function submitAction(action: "accept" | "reject") {
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

      router.refresh();
    } catch (error: any) {
      alert(error?.message || "No se pudo responder a la solicitud.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{title}</p>
      <p className="mt-2 text-sm text-slate-700">Estado: <span className="font-semibold">{getStatusLabel(request.status)}</span></p>
      {note ? <p className="mt-2 text-sm text-slate-700">{note}</p> : null}

      {canRespond ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => submitAction("accept")} disabled={loading !== null}>
            {loading === "accept" ? "Aceptando..." : "Aceptar"}
          </Button>
          <Button type="button" variant="outline" onClick={() => submitAction("reject")} disabled={loading !== null}>
            {loading === "reject" ? "Rechazando..." : "Rechazar"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
