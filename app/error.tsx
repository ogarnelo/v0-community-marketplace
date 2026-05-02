"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">!</div>
        <h1 className="text-2xl font-bold tracking-tight">Algo ha ido mal</h1>
        <p className="mt-2 text-sm text-muted-foreground">No hemos podido cargar esta pantalla. Puedes intentarlo de nuevo o volver al marketplace.</p>
        {error?.message ? (
          <details className="mt-4 rounded-xl bg-muted p-3 text-left text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">Detalle técnico</summary>
            <p className="mt-2 break-words">{error.message}</p>
            {error.digest ? <p className="mt-1 break-words">Digest: {error.digest}</p> : null}
          </details>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" onClick={reset}>Reintentar</Button>
          <Button asChild variant="outline"><a href="/marketplace">Ir al marketplace</a></Button>
        </div>
      </div>
    </div>
  );
}
