"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
  initialResolutionNote = "",
}: {
  reportId: string;
  initialStatus: ReportStatus;
  initialResolutionNote?: string | null;
}) {
  const initialNote = initialResolutionNote?.trim() || "";
  const [status, setStatus] = useState<ReportStatus>(initialStatus);
  const [resolutionNote, setResolutionNote] = useState(initialNote);
  const [savedResolutionNote, setSavedResolutionNote] = useState(initialNote);
  const [loading, setLoading] = useState<ReportStatus | "note" | null>(null);
  const [error, setError] = useState("");

  const update = async (nextStatus: ReportStatus, source: ReportStatus | "note" = nextStatus) => {
    const normalizedNote = resolutionNote.trim();
    if (loading) return;
    if (nextStatus === status && normalizedNote === savedResolutionNote) return;

    setLoading(source);
    setError("");

    try {
      const response = await fetch("/api/admin/reports/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          status: nextStatus,
          resolutionNote: normalizedNote || null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo actualizar la incidencia.");
      }
      setStatus(nextStatus);
      setSavedResolutionNote(
        nextStatus === "resolved" || nextStatus === "dismissed" ? normalizedNote : ""
      );
      if (nextStatus !== "resolved" && nextStatus !== "dismissed") {
        setResolutionNote("");
      }
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar la incidencia.");
    } finally {
      setLoading(null);
    }
  };

  const noteChanged = resolutionNote.trim() !== savedResolutionNote;

  return (
    <div className="w-full space-y-3 sm:max-w-md">
      <div className="space-y-1.5">
        <label htmlFor="report-resolution-note" className="text-sm font-medium">
          Respuesta al usuario
        </label>
        <Textarea
          id="report-resolution-note"
          value={resolutionNote}
          onChange={(event) => setResolutionNote(event.target.value.slice(0, 1000))}
          rows={4}
          placeholder="Opcional: explica la resolución o qué debe saber la persona que abrió la incidencia."
          disabled={!!loading}
        />
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Se notificará al reportante al resolver o descartar.</span>
          <span>{resolutionNote.length}/1000</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={status === option.value ? "default" : "outline"}
            onClick={() => void update(option.value)}
            disabled={!!loading || (status === option.value && !noteChanged)}
          >
            {loading === option.value ? "Guardando..." : option.label}
          </Button>
        ))}
        {noteChanged && (status === "resolved" || status === "dismissed") ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void update(status, "note")}
            disabled={!!loading}
          >
            {loading === "note" ? "Guardando..." : "Guardar respuesta"}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
