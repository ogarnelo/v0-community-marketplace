"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCw } from "lucide-react";

export default function AutomationRunButton({
  jobId,
  runAll = false,
}: {
  jobId?: string;
  runAll?: boolean;
}) {
  const [state, setState] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    setState("running");
    setMessage(null);

    try {
      const response = await fetch(runAll ? "/api/automation/run-all" : "/api/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: runAll ? "{}" : JSON.stringify({ jobId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message || data?.error || "La automatización falló.");
      }

      setState("ok");
      setMessage(runAll ? "Automatizaciones ejecutadas." : data?.message || "Automatización ejecutada.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "La automatización falló.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={run}
        disabled={state === "running"}
        variant={runAll ? "default" : "outline"}
        size={runAll ? "default" : "sm"}
        className="gap-2"
      >
        {state === "running" ? (
          <RotateCw className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {state === "running" ? "Ejecutando..." : runAll ? "Ejecutar rutina diaria" : "Ejecutar"}
      </Button>

      {message ? (
        <p className={`text-xs ${state === "error" ? "text-rose-600" : "text-emerald-700"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
