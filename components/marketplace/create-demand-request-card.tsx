"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BellPlus, CheckCircle2 } from "lucide-react";

export default function CreateDemandRequestCard({
  isLoggedIn,
  query,
  category,
  gradeLevel,
  isbn,
  resultCount,
}: {
  isLoggedIn: boolean;
  query?: string | null;
  category?: string | null;
  gradeLevel?: string | null;
  isbn?: string | null;
  resultCount: number;
}) {
  const [title, setTitle] = useState(query || category || isbn || "");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setStatus("error");
      setMessage("Indica qué material estás buscando.");
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/demand/requests/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          query,
          category,
          gradeLevel,
          isbn,
          resultCount,
          source: "marketplace_empty_state",
          route: "/marketplace",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo registrar la demanda.");
      }

      setStatus("done");
      setMessage(data?.message || "Demanda registrada.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la demanda.");
    }
  };

  return (
    <div className="mt-6 rounded-3xl border bg-muted/40 p-5 text-left">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          {status === "done" ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <BellPlus className="h-5 w-5 text-primary" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">¿Buscabas algo que no está disponible?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Registra esta demanda. Nos ayuda a saber qué productos faltan y a atraer oferta de familias y negocios locales.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Calculadora científica 4º ESO"
              className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm"
              disabled={status === "loading" || status === "done"}
            />

            {isLoggedIn ? (
              <Button
                type="button"
                onClick={submit}
                disabled={status === "loading" || status === "done"}
              >
                {status === "loading" ? "Guardando..." : status === "done" ? "Guardado" : "Quiero esto"}
              </Button>
            ) : (
              <Button asChild>
                <Link href={`/auth?next=${encodeURIComponent("/marketplace")}`}>
                  Iniciar sesión
                </Link>
              </Button>
            )}
          </div>

          {message ? (
            <p className={`mt-2 text-sm ${status === "error" ? "text-rose-600" : "text-emerald-700"}`}>
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
