"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type SavedSearchMatchItem = {
  id: string;
  listingId: string;
  listingTitle: string;
  category: string | null;
  gradeLevel: string | null;
  condition: string | null;
  searchLabel: string;
  matchedAt: string;
};

type SavedSearchMatchesListProps = {
  initialMatches: SavedSearchMatchItem[];
};

function formatMatchedAt(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SavedSearchMatchesList({ initialMatches }: SavedSearchMatchesListProps) {
  const [items, setItems] = useState(initialMatches);
  const [busyId, setBusyId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const dismissMatch = async (id: string) => {
    const previous = items;
    setBusyId(id);
    setItems((current) => current.filter((item) => item.id !== id));

    const { error } = await supabase.from("saved_search_matches").delete().eq("id", id);
    if (error) {
      setItems(previous);
      console.error("No se pudo descartar la coincidencia guardada", error);
    }
    setBusyId(null);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
        Todavía no hay novedades disponibles. Mantén tus avisos activos y te avisaremos cuando aparezca algo que encaje.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col justify-between rounded-2xl border p-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coincide con: {item.searchLabel}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-mr-2 -mt-2 h-8 w-8 shrink-0"
                disabled={busyId === item.id}
                onClick={() => dismissMatch(item.id)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Descartar coincidencia</span>
              </Button>
            </div>
            <h3 className="mt-2 line-clamp-2 font-semibold text-foreground">{item.listingTitle}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {[item.category, item.gradeLevel, item.condition].filter(Boolean).join(" · ") || "Material disponible"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Detectado {formatMatchedAt(item.matchedAt)}</p>
          </div>
          <Button asChild size="sm" className="mt-4 w-full sm:w-fit">
            <Link href={`/marketplace/listing/${item.listingId}`}>Ver anuncio</Link>
          </Button>
        </div>
      ))}
    </div>
  );
}
