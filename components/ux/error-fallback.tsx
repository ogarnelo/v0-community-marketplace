"use client";

export default function ErrorFallback() {
  return (
    <div className="p-6 text-center">
      <h2 className="text-lg font-semibold">Algo ha ido mal</h2>
      <p className="text-sm text-muted-foreground mt-2">
        Inténtalo de nuevo o vuelve atrás.
      </p>
    </div>
  );
}
