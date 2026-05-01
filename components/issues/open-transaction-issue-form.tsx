"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const ISSUE_OPTIONS = [
  ["item_not_received", "No he recibido el producto"],
  ["item_not_as_described", "El producto no coincide con la descripción"],
  ["payment_problem", "Problema con el pago"],
  ["shipping_problem", "Problema con el envío"],
  ["seller_unresponsive", "El vendedor no responde"],
  ["buyer_unresponsive", "El comprador no responde"],
  ["other", "Otro problema"],
];

export default function OpenTransactionIssueForm({
  paymentIntentId,
}: {
  paymentIntentId: string;
}) {
  const router = useRouter();
  const [issueType, setIssueType] = useState("item_not_received");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(async () => {
          setError("");

          const response = await fetch("/api/transaction-issues/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentIntentId,
              issueType,
              description,
            }),
          });

          const result = await response.json().catch(() => null);

          if (!response.ok) {
            setError(result?.error || "No se pudo abrir la incidencia.");
            return;
          }

          router.push(`/account/issues/${result.issueId}`);
          router.refresh();
        });
      }}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">Tipo de incidencia</label>
        <select
          value={issueType}
          onChange={(event) => setIssueType(event.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        >
          {ISSUE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Cuéntanos qué ha pasado</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={6}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          placeholder="Describe el problema con detalle. Incluye fechas, mensajes relevantes o cualquier información útil."
        />
        <p className="text-xs text-muted-foreground">
          Esta información será visible para las partes de la operación y ayudará a resolver el caso.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Creando incidencia..." : "Abrir incidencia"}
      </Button>
    </form>
  );
}
