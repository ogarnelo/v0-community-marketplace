"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCw } from "lucide-react";

export default function TransactionVelocityRunButton() {
  const [state, setState] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setState("running");
    setMessage(null);

    try {
      const response = await fetch("/api/transaction-velocity/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message || data?.error || "No se pudo ejecutar.");
      }

      setState("ok");
      setMessage(`Acciones creadas: ${data?.createdActions || 0}`);
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo ejecutar.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={run} disabled={state === "running"} className="gap-2">
        {state === "running" ? <RotateCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {state === "running" ? "Ejecutando..." : "Generar acciones"}
      </Button>
      {message ? (
        <p className={`text-xs ${state === "error" ? "text-rose-600" : "text-emerald-700"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
