"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function DeleteSavedSearchButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const response = await fetch("/api/saved-searches/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          alert(result?.error || "No se pudo eliminar la búsqueda");
          return;
        }
        router.refresh();
      })}
    >
      {pending ? "Eliminando..." : "Eliminar"}
    </Button>
  );
}
