import Link from "next/link";

export default function CourseMaterialsBrowser({
  materials,
}: {
  materials: any[];
}) {
  if (!materials.length) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold">Aún no hay materiales en el catálogo</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Añade los primeros libros o materiales para que Wetudy aprenda qué se usa en cada curso.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {materials.map((material) => {
        const params = new URLSearchParams();
        if (material.isbn) params.set("isbn", material.isbn);
        else params.set("q", material.title);
        if (material.grade_level) params.set("grade", material.grade_level);

        return (
          <div key={material.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                {material.grade_level}
              </span>
              {material.subject ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                  {material.subject}
                </span>
              ) : null}
              {material.source === "crowdsourced" ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  Comunidad
                </span>
              ) : null}
            </div>

            <h3 className="text-lg font-semibold">{material.title}</h3>
            {material.isbn ? (
              <p className="mt-1 text-sm text-muted-foreground">ISBN: {material.isbn}</p>
            ) : null}

            <Link
              href={`/marketplace?${params.toString()}`}
              className="mt-4 inline-flex rounded-lg border px-4 py-2 text-sm font-medium"
            >
              Ver anuncios compatibles
            </Link>
          </div>
        );
      })}
    </div>
  );
}
