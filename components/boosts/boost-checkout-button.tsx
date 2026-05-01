"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { BoostPlanId } from "@/lib/boosts/pricing";

export default function BoostCheckoutButton({
  listingId,
  planId,
}: {
  listingId: string;
  planId: BoostPlanId;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError("");

            const response = await fetch("/api/boosts/create-checkout-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ listingId, planId }),
            });

            const result = await response.json().catch(() => null);

            if (!response.ok || !result?.url) {
              setError(result?.error || "No se pudo iniciar el pago del boost.");
              return;
            }

            window.location.assign(result.url);
          })
        }
      >
        {pending ? "Preparando pago..." : "Pagar y destacar"}
      </Button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
