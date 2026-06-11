"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function SeoPageStatusActions({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState<string | null>(null);

  const update = async (nextStatus: string) => {
    setLoading(nextStatus);
    try {
      const response = await fetch("/api/seo/pages/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });

      if (!response.ok) throw new Error("No se pudo actualizar");
      setStatus(nextStatus);
    } catch {
      alert("No se pudo actualizar la página SEO.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant={status === "published" ? "default" : "outline"}
        disabled={loading !== null}
        onClick={() => update("published")}
      >
        {loading === "published" ? "Publicando..." : "Publicar"}
      </Button>

      <Button
        type="button"
        size="sm"
        variant={status === "draft" ? "default" : "outline"}
        disabled={loading !== null}
        onClick={() => update("draft")}
      >
        Draft
      </Button>

      <Button
        type="button"
        size="sm"
        variant={status === "noindex" ? "default" : "outline"}
        disabled={loading !== null}
        onClick={() => update("noindex")}
      >
        Noindex
      </Button>

      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={loading !== null}
        onClick={() => update("archived")}
      >
        Archivar
      </Button>
    </div>
  );
}
