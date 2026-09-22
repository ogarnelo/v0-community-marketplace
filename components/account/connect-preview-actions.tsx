"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConnectPreviewActions({
  hasAccount,
}: {
  hasAccount: boolean;
}) {
  const [loading, setLoading] = useState<"onboarding" | "sync" | null>(null);
  const [message, setMessage] = useState("");

  const startOnboarding = async () => {
    setLoading("onboarding");
    setMessage("");
    try {
      const response = await fetch("/api/commerce/connect/onboarding", {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "No se pudo abrir Stripe.");
      }
      window.location.assign(payload.url);
    } catch (error: any) {
      setMessage(error?.message || "No se pudo abrir Stripe.");
      setLoading(null);
    }
  };

  const syncStatus = async () => {
    setLoading("sync");
    setMessage("");
    try {
      const response = await fetch("/api/commerce/connect/sync", {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo sincronizar.");
      }
      setMessage("Estado actualizado.");
      window.location.reload();
    } catch (error: any) {
      setMessage(error?.message || "No se pudo sincronizar.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Button type="button" onClick={startOnboarding} disabled={Boolean(loading)}>
        {loading === "onboarding"
          ? "Abriendo Stripe..."
          : hasAccount
            ? "Continuar onboarding"
            : "Configurar cobros de prueba"}
      </Button>
      {hasAccount ? (
        <Button
          type="button"
          variant="outline"
          onClick={syncStatus}
          disabled={Boolean(loading)}
        >
          {loading === "sync" ? "Sincronizando..." : "Actualizar estado"}
        </Button>
      ) : null}
      {message ? (
        <p className="w-full text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
