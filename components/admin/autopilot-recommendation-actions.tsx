"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function AutopilotRecommendationActions({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState<string | null>(null);

  async function update(nextStatus: string) {
    setLoading(nextStatus);
    try {
      const response = await fetch("/api/autopilot/recommendations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (!response.ok) throw new Error("failed");
      setStatus(nextStatus);
    } catch {
      alert("No se pudo actualizar la recomendación.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant={status === "in_progress" ? "default" : "outline"} disabled={!!loading} onClick={() => update("in_progress")}>
        En progreso
      </Button>
      <Button size="sm" variant={status === "done" ? "default" : "outline"} disabled={!!loading} onClick={() => update("done")}>
        Hecho
      </Button>
      <Button size="sm" variant="outline" disabled={!!loading} onClick={() => update("dismissed")}>
        Descartar
      </Button>
    </div>
  );
}
