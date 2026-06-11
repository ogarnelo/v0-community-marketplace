"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function CloseTransactionIssueButton({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        const confirmed = window.confirm("¿Quieres cerrar esta incidencia?");
        if (!confirmed) return;

        startTransition(async () => {
          const response = await fetch("/api/transaction-issues/close", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issueId }),
          });

          const result = await response.json().catch(() => null);

          if (!response.ok) {
            alert(result?.error || "No se pudo cerrar la incidencia.");
            return;
          }

          router.refresh();
        });
      }}
    >
      {pending ? "Cerrando..." : "Cerrar incidencia"}
    </Button>
  );
}
