"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

type SavedSearch = {
  id: string;
  query: string | null;
  isbn_query: string | null;
  category: string | null;
  grade_level: string | null;
  listing_type: string | null;
  condition: string | null;
  only_my_community: boolean | null;
  results_count: number | null;
  notifications_enabled: boolean | null;
  created_at: string | null;
};

type SavedSearchesListProps = {
  initialSearches: SavedSearch[];
};

function buildMarketplaceHref(search: SavedSearch) {
  const params = new URLSearchParams();
  if (search.query) params.set("q", search.query);
  if (search.isbn_query) params.set("isbn", search.isbn_query);
  if (search.category) params.set("category", search.category);
  if (search.grade_level) params.set("grade", search.grade_level);
  const qs = params.toString();
  return qs ? `/marketplace?${qs}` : "/marketplace";
}

function describeSearch(search: SavedSearch) {
  const parts = [
    search.query ? `“${search.query}”` : null,
    search.isbn_query ? `ISBN ${search.isbn_query}` : null,
    search.category,
    search.grade_level,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Búsqueda guardada";
}

export function SavedSearchesList({ initialSearches }: SavedSearchesListProps) {
  const [items, setItems] = useState(initialSearches);
  const [busyId, setBusyId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const toggleNotifications = async (id: string, enabled: boolean) => {
    setBusyId(id);
    const previous = items;
    setItems((current) => current.map((item) => item.id === id ? { ...item, notifications_enabled: enabled } : item));

    const { error } = await supabase
      .from("saved_searches")
      .update({ notifications_enabled: enabled })
      .eq("id", id);

    if (error) setItems(previous);
    setBusyId(null);
  };

  const deleteSearch = async (id: string) => {
    setBusyId(id);
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== id));

    const { error } = await supabase.from("saved_searches").delete().eq("id", id);
    if (error) setItems(previous);
    setBusyId(null);
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="rounded-full bg-primary/10 p-3"><Search className="h-6 w-6 text-primary" /></div>
          <div>
            <h2 className="text-lg font-semibold">Aún no tienes búsquedas guardadas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cuando no encuentres un material, podrás guardar la búsqueda para retomarla más tarde.</p>
          </div>
          <Button asChild><Link href="/marketplace">Buscar material</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const enabled = Boolean(item.notifications_enabled);
        return (
          <Card key={item.id}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{describeSearch(item)}</h2>
                    {item.only_my_community ? <Badge variant="secondary">Mi comunidad</Badge> : null}
                    {item.results_count === 0 ? <Badge variant="outline">Sin resultados</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Guardada {item.created_at ? new Date(item.created_at).toLocaleDateString("es-ES") : "recientemente"}. {enabled ? "Aviso activo: te enviaremos un email cuando aparezca una coincidencia." : "Aviso pausado: puedes reactivarlo cuando quieras."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-full border px-3 py-2 text-sm">
                    {enabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                    <span>Aviso</span>
                    <Switch checked={enabled} disabled={busyId === item.id} onCheckedChange={(checked) => toggleNotifications(item.id, checked)} />
                  </div>
                  <Button asChild variant="outline" size="sm"><Link href={buildMarketplaceHref(item)}>Reabrir</Link></Button>
                  <Button variant="ghost" size="icon" disabled={busyId === item.id} onClick={() => deleteSearch(item.id)}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Borrar búsqueda</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
