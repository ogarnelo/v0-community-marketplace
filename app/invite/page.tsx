
import Link from "next/link";

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const ref = params?.ref;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-3xl border bg-card p-8 shadow-sm">
        <div className="space-y-4">
          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Comunidad educativa
          </span>
          <h1 className="text-3xl font-bold tracking-tight">Compra, vende y reutiliza con Wetudy</h1>
          <p className="text-muted-foreground">
            Encuentra libros, uniformes y material educativo dentro de tu comunidad. Habla con vendedores, negocia y paga de forma segura.
          </p>
          {ref ? (
            <p className="text-sm text-muted-foreground">
              Has llegado con una invitación. Más adelante podremos atribuir esta referencia.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/marketplace"
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Explorar marketplace
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
