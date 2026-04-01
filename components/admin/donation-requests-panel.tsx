"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export type DonationRequestAdminItem = {
  id: string;
  listingId: string;
  listingTitle: string;
  requesterName: string;
  status: string | null;
  note: string | null;
  createdAt: string | null;
};

interface DonationRequestsPanelProps {
  requests: DonationRequestAdminItem[];
}

export function DonationRequestsPanel({ requests }: DonationRequestsPanelProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (requests.length === 0) {
    return null;
  }

  const submitReview = async (donationRequestId: string, action: "approve" | "reject") => {
    if (loadingId) return;
    setLoadingId(donationRequestId);

    try {
      const response = await fetch("/api/donations/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          donationRequestId,
          action,
          note: notes[donationRequestId] || "",
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo revisar la solicitud.");
      }

      window.location.reload();
    } catch (error: any) {
      alert(error?.message || "No se pudo revisar la solicitud.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Card className="mt-8 border-border">
      <CardHeader>
        <CardTitle>Solicitudes de donación pendientes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {requests.map((request) => (
          <div key={request.id} className="rounded-lg border p-4">
            <p className="font-medium">{request.listingTitle}</p>
            <p className="text-sm text-muted-foreground">Solicitante: {request.requesterName}</p>
            <p className="text-sm text-muted-foreground">Estado: {request.status || "pending"}</p>
            {request.note ? (
              <p className="mt-2 text-sm text-muted-foreground">Nota: {request.note}</p>
            ) : null}

            <Textarea
              className="mt-3"
              placeholder="Notas internas u observaciones"
              value={notes[request.id] || ""}
              onChange={(event) =>
                setNotes((prev) => ({ ...prev, [request.id]: event.target.value }))
              }
            />

            {request.status === "pending" ? (
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  onClick={() => submitReview(request.id, "approve")}
                  disabled={loadingId === request.id}
                >
                  Aprobar y archivar anuncio
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => submitReview(request.id, "reject")}
                  disabled={loadingId === request.id}
                >
                  Rechazar
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
