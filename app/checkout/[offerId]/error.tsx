"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-12 text-center">
      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">No hemos podido cargar esta sección</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ha ocurrido un error inesperado. Puedes reintentar o volver al marketplace.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={reset}>Reintentar</Button>
          <Button asChild variant="outline"><Link href="/marketplace">Ir al marketplace</Link></Button>
        </div>
      </div>
    </div>
  );
}
