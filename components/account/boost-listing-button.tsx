"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export default function BoostListingButton({ listingId }: { listingId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
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
            alert("Anuncio impulsado gratis durante 7 días.");
          })
        }
      >
        {pending ? "Impulsando..." : done ? "Impulsado" : "Impulso gratis"}
      </Button>

      <Link
        href={`/boosts/${listingId}`}
        className="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
      >
        Destacar más
      </Link>
    </div>
  );
}
