import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicDirectorySchool } from "@/lib/schools/directory-public";
import { getSchoolDirectoryUrl, getWetudyDirectoryCode } from "@/lib/schools/directory-identity";

export const revalidate = 600;

type DetailProps = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: DetailProps): Promise<Metadata> {
  const { code } = await params;
  const centre = await getPublicDirectorySchool(code);
  if (!centre) {
    return { title: "Centro no disponible | Wetudy", robots: { index: false, follow: false } };
  }
  const title = `${centre.name} en ${centre.municipality} | Wetudy`;
  const description =
    `Consulta la ficha de ${centre.name} (${centre.municipality}, ${centre.province}) en el directorio educativo de Wetudy. La inclusión no supone adhesión del centro.`;
  return {
    title, description,
    alternates: { canonical: getSchoolDirectoryUrl(centre.official_code) },
    // Being in the directory never grants search indexing automatically.
    // Only a manually SEO-approved centre with an independently verified
    // active (non-test) Wetudy community can become indexable.
    robots: { index: centre.can_index, follow: true },
  };
}

export default async function DirectoryCentrePage({ params }: DetailProps) {
  const { code } = await params;
  const centre = await getPublicDirectorySchool(code);
  if (!centre) notFound();

  const publicCode = getWetudyDirectoryCode(centre.official_code);
  const qrPath = `/api/school-directory/${centre.official_code}/qr`;

  return (
    <main className="mx-auto max-w-3xl space-y-7 px-4 py-12">
      <nav aria-label="Ruta de navegación" className="text-sm text-muted-foreground">
        <Link href="/centros" className="underline">Directorio de centros</Link>
        <span aria-hidden="true"> / </span>{centre.municipality}
      </nav>
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold">{centre.name}</h1>
        <p className="text-muted-foreground">
          {centre.municipality} · {centre.province} · {centre.autonomous_community}
        </p>
        <p className="text-sm">
          {centre.school_type} · CP {centre.postal_code}
        </p>
        {centre.address ? <p className="text-sm">{centre.address}</p> : null}
        <p className="rounded-lg border p-4 text-sm">
          {centre.verified_community
            ? "Comunidad de Wetudy verificada y disponible."
            : "Este centro está en el directorio informativo. Su incorporación a Wetudy no está confirmada."}
        </p>
      </section>
      <section className="space-y-4 rounded-xl border p-5">
        <h2 className="text-xl font-semibold">Código y QR de Wetudy</h2>
        <p className="text-sm">Referencia pública del centro: <strong>{publicCode}</strong></p>
        <p className="text-xs text-muted-foreground">
          Código oficial del centro: {centre.official_code}. Este código y QR
          identifican la ficha pública, no sirven como contraseña, invitación
          ni conceden acceso a una comunidad.
        </p>
        {/* No QR images stored in Supabase: generated as needed from the canonical page URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrPath}
          alt={`Código QR de la ficha informativa de ${centre.name}`}
          width={220}
          height={220}
          loading="lazy"
          className="rounded-lg bg-white p-3"
        />
        <div>
          <a href={`${qrPath}?format=png&download=1`} download
            className="inline-flex rounded-lg border px-4 py-2 text-sm font-medium">
            Descargar QR del centro
          </a>
        </div>
      </section>
      <p className="text-sm text-muted-foreground">
        Wetudy es independiente del Ministerio y de los centros incluidos
        en este directorio. La presencia de una ficha no acredita colaboración ni adhesión del AMPA.
      </p>
      <Link href="/marketplace" className="inline-flex rounded-lg border px-4 py-2">
        Explorar el marketplace de Wetudy
      </Link>
    </main>
  );
}
