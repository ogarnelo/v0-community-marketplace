"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global route error", error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="max-w-lg rounded-3xl border bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold tracking-tight">Algo no ha ido bien</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Hemos detectado un error cargando esta página. Puedes reintentarlo o volver al marketplace.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={reset}>Reintentar</Button>
              <Button asChild variant="outline">
                <Link href="/marketplace">Ir al marketplace</Link>
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
