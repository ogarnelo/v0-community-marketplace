"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Layers3, Lightbulb, PackagePlus } from "lucide-react";

type ListingRow = {
  id: string;
  title: string;
  price: number | null;
  category: string | null;
  grade_level: string | null;
  status: string | null;
};

type VariationIdea = {
  title: string;
  description: string;
  price: number | null;
};

export default function InventoryExpansionPanel({ listings }: { listings: ListingRow[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [ideasByListing, setIdeasByListing] = useState<Record<string, VariationIdea[]>>({});
  const [message, setMessage] = useState<string | null>(null);

  const selectedListings = useMemo(
    () => listings.filter((listing) => selectedIds.includes(listing.id)),
    [listings, selectedIds]
  );

  const toggle = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  async function duplicateListing(listingId: string) {
    setLoadingId(`duplicate:${listingId}`);
    setMessage(null);

    try {
      const response = await fetch("/api/listings/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "No se pudo duplicar.");

      window.location.href = `/marketplace/edit/${data.listingId}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo duplicar.");
    } finally {
      setLoadingId(null);
    }
  }

  async function suggestVariations(listingId: string) {
    setLoadingId(`ideas:${listingId}`);
    setMessage(null);

    try {
      const response = await fetch("/api/listings/variations/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "No se pudieron generar ideas.");

      setIdeasByListing((current) => ({
        ...current,
        [listingId]: data.ideas || [],
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron generar ideas.");
    } finally {
      setLoadingId(null);
    }
  }

  async function createPack() {
    setLoadingId("pack");
    setMessage(null);

    try {
      const response = await fetch("/api/listings/packs/create-from-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: selectedIds }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "No se pudo crear el pack.");

      window.location.href = `/marketplace/edit/${data.listingId}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el pack.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="grid gap-5">
      {message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {message}
        </div>
      ) : null}

      <div className="rounded-3xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold">Crear pack desde varios anuncios</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecciona al menos 2 anuncios con foto. Wetudy creará un pack con fotos copiadas y precio sugerido.
            </p>
          </div>

          <Button onClick={createPack} disabled={selectedIds.length < 2 || loadingId === "pack"} className="gap-2">
            <Layers3 className="h-4 w-4" />
            {loadingId === "pack" ? "Creando..." : `Crear pack (${selectedIds.length})`}
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {listings.map((listing) => {
          const ideas = ideasByListing[listing.id] || [];

          return (
            <article key={listing.id} className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(listing.id)}
                      onChange={() => toggle(listing.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-semibold">{listing.title}</span>
                      <span className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {listing.category ? <Badge variant="secondary">{listing.category}</Badge> : null}
                        {listing.grade_level ? <Badge variant="outline">{listing.grade_level}</Badge> : null}
                        {typeof listing.price === "number" ? <Badge variant="outline">{listing.price}€</Badge> : null}
                      </span>
                    </span>
                  </label>

                  {ideas.length > 0 ? (
                    <div className="mt-4 grid gap-2">
                      {ideas.map((idea) => (
                        <div key={idea.title} className="rounded-2xl border bg-muted/40 p-3">
                          <p className="font-medium">{idea.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{idea.description}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/marketplace/new/quick?title=${encodeURIComponent(idea.title)}&price=${encodeURIComponent(String(idea.price || ""))}`}>
                                Usar idea
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => duplicateListing(listing.id)}
                    disabled={loadingId === `duplicate:${listing.id}`}
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Duplicar
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => suggestVariations(listing.id)}
                    disabled={loadingId === `ideas:${listing.id}`}
                    className="gap-2"
                  >
                    <Lightbulb className="h-4 w-4" />
                    Ideas
                  </Button>

                  <Button asChild size="sm" className="gap-2">
                    <Link href={`/marketplace/new/quick?source=inventory&category=${encodeURIComponent(listing.category || "")}&grade_level=${encodeURIComponent(listing.grade_level || "")}`}>
                      <PackagePlus className="h-4 w-4" />
                      Similar
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {listings.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card p-8 text-center">
          <h2 className="text-xl font-semibold">Aún no tienes anuncios disponibles</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Publica tu primer anuncio con foto para poder duplicarlo, crear packs o generar variaciones.
          </p>
          <Button asChild className="mt-4">
            <Link href="/marketplace/new/quick">Publicar rápido</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
