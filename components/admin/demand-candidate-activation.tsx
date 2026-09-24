"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export type DemandCandidateView = {
  userId: string;
  name: string;
  score: number;
  affinity: "alta" | "media";
  reasons: string[];
  lastListingAt: string | null;
};

export function DemandCandidateActivation({
  opportunityKey,
  candidates,
  message,
}: {
  opportunityKey: string;
  candidates: DemandCandidateView[];
  message: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const [error, setError] = useState("");

  const selectable = useMemo(
    () => candidates.filter((candidate) => !sent.includes(candidate.userId)),
    [candidates, sent]
  );

  const toggle = (userId: string, checked: boolean) => {
    setSelected((current) =>
      checked ? Array.from(new Set([...current, userId])) : current.filter((id) => id !== userId)
    );
  };

  const activate = async () => {
    if (sending || selected.length === 0) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/demand/opportunities/${encodeURIComponent(opportunityKey)}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserIds: selected }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "No se pudo enviar la activación.");

      const activated = Array.isArray(payload?.activatedUserIds) ? payload.activatedUserIds : selected;
      setSent((current) => Array.from(new Set([...current, ...activated])));
      setSelected([]);
    } catch (cause: any) {
      setError(cause?.message || "No se pudo enviar la activación.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Previsualización del mensaje</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{message}</p>
        <p className="mt-2 text-xs text-muted-foreground">Canal B1: notificación dentro de Wetudy. No se envía email de campaña.</p>
      </div>

      {selectable.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay candidatos fuertes pendientes de contacto para esta oportunidad.</p>
      ) : (
        <div className="space-y-3">
          {selectable.map((candidate) => (
            <label key={candidate.userId} className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">
              <Checkbox
                className="mt-1"
                checked={selected.includes(candidate.userId)}
                onCheckedChange={(checked) => toggle(candidate.userId, checked === true)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{candidate.name}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Afinidad {candidate.affinity} · {candidate.score}</span>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={sending || selected.length === 0} onClick={() => void activate()} className="gap-2">
          <Send className="h-4 w-4" />
          {sending ? "Enviando..." : `Enviar a ${selected.length} seleccionado${selected.length === 1 ? "" : "s"}`}
        </Button>
        {sent.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> {sent.length} activación{sent.length === 1 ? "" : "es"} enviada{sent.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
