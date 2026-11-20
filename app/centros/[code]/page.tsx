import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  directoryPageUrl,
  readListedDirectoryCentre,
  VALID_OFFICIAL_SCHOOL_CODE,
} from "@/lib/schools/listed-directory-centre";

export const dynamic = "force-dynamic";
const gate = () => process.env.WETUDY_PUBLIC_SCHOOL_DIRECTORY_ENABLED === "true";
type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Never index an imported or even an editorially listed school by default.
  // SEO approval + actual verified activity will require a separate review.
  const disabled: Metadata = {
    title: "Centro no disponible | WETUDY",
    robots: { index: false, follow: false },
  };
  if (!gate()) return disabled;
  const { code } = await params;
  if (!VALID_OFFICIAL_SCHOOL_CODE.test(code)) return disabled;
  try {
    const centre = await readListedDirectoryCentre(code);
    if (!centre) return disabled;
    return {
      title: `${centre.name} · Directorio informativo | WETUDY`,
      description: `Ficha informativa de ${centre.name} en ${centre.municipality}. Su inclusión no implica adhesión a WETUDY.`,
      alternates: { canonical: directoryPageUrl(centre.official_code) },
      robots: { index: false, follow: false },
    };
  } catch {
    return disabled;
  }
}

export default async function DirectoryCentrePage({ params }: Props) {
  if (!gate()) notFound();
  const { code } = await params;
  if (!VALID_OFFICIAL_SCHOOL_CODE.test(code)) notFound();
  let centre;
  try {
    centre = await readListedDirectoryCentre(code);
  } catch {
    // Do not reveal catalogue state or database errors in a public route.
    notFound();
  }
  if (!centre) notFound();

  const qrPath = `/api/school-directory/${centre.official_code}/qr`;
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
    <nav aria-label="Ruta de navegación">
      <Link className="underline underline-offset-2" href="/centros">
        Directorio informativo
      </Link>
    </nav>
    <header className="space-y-3">
      <h1 className="text-3xl font-bold">{centre.name}</h1>
      <p className="text-muted-foreground">
        {centre.municipality} · {centre.province} · {centre.autonomous_community}
      </p>
      <p className="text-sm">{centre.school_type} · {centre.category}</p>
      <p className="text-sm">Código oficial: {centre.official_code} · CP: {centre.postal_code}</p>
      {centre.address ? <p className="text-sm">{centre.address}</p> : null}
    </header>
    <section className="rounded-lg border p-5 space-y-2">
      <h2 className="font-semibold">Información de la ficha</h2>
      <p className="text-sm text-muted-foreground">
        La presencia en este directorio no confirma que el colegio, su AMPA o
        sus familias participen en WETUDY. WETUDY es independiente de los centros
        incluidos. Esta ficha no sirve para incorporarse a ninguna comunidad.
      </p>
    </section>
    <section className="rounded-lg border p-5 space-y-3">
      <h2 className="font-semibold">Código QR informativo</h2>
      <p className="text-sm text-muted-foreground">
        El QR abre exclusivamente esta ficha informativa pública. No contiene
        invitaciones, contraseñas ni códigos de acceso escolar.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrPath} alt={`QR informativo de ${centre.name}`}
        width={220} height={220} loading="lazy" className="rounded-md bg-white p-3" />
      <a className="inline-flex rounded-md border px-4 py-2 text-sm font-medium"
        href={`${qrPath}?format=png&download=1`} download>
        Descargar QR PNG
      </a>
    </section>
  </main>;
}
