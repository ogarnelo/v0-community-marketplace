
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export default function BoostListingButton({ listingId }: { listingId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending || done}
      onClick={() =>
        startTransition(async () => {
          const response = await fetch("/api/listings/boost", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listingId }),
          });

          const result = await response.json().catch(() => null);

          if (!response.ok) {
            alert(result?.error || "No se pudo impulsar el anuncio");
            return;
          }

          setDone(true);
          alert("Anuncio impulsado. Volverá a mostrarse como más reciente.");
        })
      }
    >
      {pending ? "Impulsando..." : done ? "Impulsado" : "Impulsar anuncio"}
    </Button>
  );
}
