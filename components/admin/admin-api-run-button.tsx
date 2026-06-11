"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AdminApiRunButton({
  endpoint,
  label,
  icon,
}: {
  endpoint: string;
  label: string;
  icon?: ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function run() {
    if (loading || isPending) return;
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(endpoint, { method: "POST" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo ejecutar la acción.");
      }

      setMessage("Ejecutado correctamente.");
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo ejecutar la acción.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={run} disabled={loading || isPending}>
        {icon}
        {loading || isPending ? "Ejecutando..." : label}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
