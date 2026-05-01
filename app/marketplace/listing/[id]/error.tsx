"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ListingError({ reset }: { reset: () => void }) {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-3xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">No hemos podido cargar este anuncio</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Puede ser un problema temporal o que el anuncio haya cambiado de estado.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset}>Reintentar</Button>
          <Button asChild variant="outline">
            <Link href="/marketplace">Volver al marketplace</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
