import Link from "next/link";

export default function BusinessDashboardLinkCard() {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <h3 className="text-base font-semibold">Panel profesional</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Gestiona tu visibilidad, seguidores y catálogo desde un panel pensado para negocios locales.
      </p>
      <Link
        href="/account/business"
        className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Abrir panel profesional
      </Link>
    </div>
  );
}
