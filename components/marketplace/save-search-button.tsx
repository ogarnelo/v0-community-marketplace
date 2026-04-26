"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export default function SaveSearchButton({
  query,
  category,
  gradeLevel,
  condition,
  listingType,
  isbn,
  minPrice,
  maxPrice,
  label = "Guardar búsqueda",
}: {
  query?: string | null;
  category?: string | null;
  gradeLevel?: string | null;
  condition?: string | null;
  listingType?: string | null;
  isbn?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  label?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const name = useMemo(() => {
    const parts = [query, isbn ? `ISBN ${isbn}` : null, category && category !== "all" ? category : null, gradeLevel && gradeLevel !== "all" ? gradeLevel : null, listingType && listingType !== "all" ? listingType : null].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "Búsqueda guardada";
  }, [category, gradeLevel, isbn, listingType, query]);

  return (
    <Button
      type="button"
      variant={saved ? "secondary" : "outline"}
      disabled={pending || saved}
      onClick={() => startTransition(async () => {
        const response = await fetch("/api/saved-searches/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, query, category, gradeLevel, condition, listingType, isbn, minPrice, maxPrice, emailEnabled: true, pushEnabled: true }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          alert(result?.error || "No se pudo guardar la búsqueda");
          return;
        }
        setSaved(true);
        alert("Búsqueda guardada. Te avisaremos cuando aparezcan anuncios compatibles.");
      })}
    >
      {pending ? "Guardando..." : saved ? "Búsqueda guardada" : label}
    </Button>
  );
}
