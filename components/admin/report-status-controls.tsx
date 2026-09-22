"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

const OPTIONS: Array<{ value: ReportStatus; label: string }> = [
  { value: "open", label: "Abierta" },
  { value: "reviewing", label: "En revisión" },
  { value: "resolved", label: "Resuelta" },
  { value: "dismissed", label: "Descartada" },
];

export function ReportStatusControls({
  reportId,
  initialStatus,
}: {
  reportId: string;
  initialStatus: ReportStatus;
}) {
  const [status, setStatus] = useState<ReportStatus>(initialStatus);
  const [loading, setLoading] = useState<ReportStatus | null>(null);
  const [error, setError] = useState("");

  const update = async (nextStatus: ReportStatus) => {
    if (loading || nextStatus === status) return;
    setLoading(nextStatus);
    setError("");

    try {
      const response = await fetch("/api/admin/reports/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status: nextStatus }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo actualizar la incidencia.");
      }
      setStatus(nextStatus);
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar la incidencia.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={status === option.value ? "default" : "outline"}
            onClick={() => void update(option.value)}
            disabled={!!loading}
          >
            {loading === option.value ? "Guardando..." : option.label}
          </Button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
