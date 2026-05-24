"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ConversionNudgeActions({
  id,
  href,
  actionLabel = "Abrir",
}: {
  id: string;
  href?: string | null;
  actionLabel?: string | null;
}) {
  const [dismissed, setDismissed] = useState(false);

  async function update(status: "clicked" | "dismissed") {
    await fetch("/api/conversion/nudges/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).catch(() => null);

    if (status === "dismissed") setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {href ? (
        <Button asChild size="sm" onClick={() => void update("clicked")}>
          <Link href={href}>{actionLabel || "Abrir"}</Link>
        </Button>
      ) : null}

      <Button size="sm" variant="outline" onClick={() => void update("dismissed")}>
        Descartar
      </Button>
    </div>
  );
}
