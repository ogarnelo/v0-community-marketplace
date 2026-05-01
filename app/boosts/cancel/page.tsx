import Link from "next/link";

export default function BoostCancelPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Pago cancelado</h1>
        <p className="mt-2 text-muted-foreground">
          No se ha activado ningún boost. Puedes volver a intentarlo cuando quieras.
        </p>
        <Link href="/account/listings" className="mt-4 inline-flex rounded-lg border px-4 py-2 text-sm font-medium">
          Volver a mis anuncios
        </Link>
      </div>
    </div>
  );
}
