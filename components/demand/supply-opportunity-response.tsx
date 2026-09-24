"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SupplyOpportunityResponse({
  opportunityKey,
  initialResponse,
}: {
  opportunityKey: string;
  initialResponse?: string | null;
}) {
  const router = useRouter();
  const [responseValue, setResponseValue] = useState(initialResponse || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const respond = async (response: "have_one" | "dont_have") => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await fetch(`/api/demand/opportunities/${encodeURIComponent(opportunityKey)}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const payload = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(payload?.error || "No se pudo guardar tu respuesta.");
      setResponseValue(response);
      if (response === "have_one") {
        router.push(`/marketplace/new?opportunity=${encodeURIComponent(opportunityKey)}`);
      }
    } catch (cause: any) {
      setError(cause?.message || "No se pudo guardar tu respuesta.");
    } finally {
      setBusy(false);
    }
  };

  if (responseValue === "dont_have") {
    return <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">Gracias. Hemos registrado que ahora mismo no tienes este material.</p>;
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button disabled={busy} onClick={() => void respond("have_one")}>Tengo uno · Publicar ahora</Button>
      <Button disabled={busy} variant="outline" onClick={() => void respond("dont_have")}>No tengo</Button>
      {error ? <p className="self-center text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
