"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, X } from "lucide-react";

function priorityClassName(priority: string) {
  switch (priority) {
    case "urgent":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "high":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "medium":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function priorityLabel(priority: string) {
  switch (priority) {
    case "urgent":
      return "Urgente";
    case "high":
      return "Alta";
    case "medium":
      return "Media";
    default:
      return "Baja";
  }
}

export default function TransactionVelocityActionCard({
  action,
}: {
  action: {
    id: string;
    title: string;
    message: string;
    priority: string;
    href?: string | null;
    action_label?: string | null;
    created_at: string;
  };
}) {
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function update(status: "completed" | "dismissed") {
    setLoading(status);
    try {
      const response = await fetch("/api/transaction-velocity/actions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: action.id, status }),
      });

      if (!response.ok) throw new Error("No se pudo actualizar.");
      setHidden(true);
    } catch {
      alert("No se pudo actualizar la acción.");
    } finally {
      setLoading(null);
    }
  }

  if (hidden) return null;

  return (
    <article className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={priorityClassName(action.priority)}>
              {priorityLabel(action.priority)}
            </Badge>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {new Date(action.created_at).toLocaleString("es-ES")}
            </span>
          </div>

          <h2 className="mt-3 text-lg font-semibold">{action.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{action.message}</p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {action.href ? (
            <Button asChild>
              <Link href={action.href}>{action.action_label || "Abrir"}</Link>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={() => update("completed")}
            disabled={loading !== null}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Hecho
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => update("dismissed")}
            disabled={loading !== null}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Ocultar
          </Button>
        </div>
      </div>
    </article>
  );
}
