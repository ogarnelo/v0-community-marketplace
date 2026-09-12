import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type RelatedListing = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  gradeLevel?: string | null;
  condition?: string | null;
  type?: string | null;
  price?: number | null;
  photos?: string[];
  schoolId?: string | null;
  status?: string | null;
};

type RelatedListingsSectionProps = {
  listings: RelatedListing[];
  currentSchoolId?: string | null;
};

function formatPrice(value?: number | null) {
  if (typeof value !== "number") return "Consultar";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function isDonation(type?: string | null) {
  return type === "donation" || type === "donacion";
}

export default function RelatedListingsSection({
  listings,
  currentSchoolId,
}: RelatedListingsSectionProps) {
  if (!listings || listings.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Anuncios relacionados</h2>
          <p className="text-sm text-muted-foreground">
            Material parecido que puede encajar con tu búsqueda.
          </p>
        </div>
        <Link href="/marketplace" className="text-sm font-medium text-primary hover:underline">
          Ver más
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {listings.slice(0, 4).map((listing) => {
          const firstPhoto = listing.photos?.[0] || null;
          const inMySchool = currentSchoolId && listing.schoolId === currentSchoolId;

          return (
            <Link
              key={listing.id}
              href={`/marketplace/listing/${listing.id}`}
              className="group overflow-hidden rounded-2xl border bg-background transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="aspect-[4/3] bg-muted">
                {firstPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={firstPhoto}
                    alt={listing.title}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
                    Sin foto
                  </div>
                )}
              </div>

              <div className="space-y-2 p-3">
                <div className="flex flex-wrap gap-1">
                  {inMySchool ? <Badge variant="secondary">Mi comunidad</Badge> : null}
                  {listing.category ? <Badge variant="outline">{listing.category}</Badge> : null}
                </div>
                <h3 className="line-clamp-2 text-sm font-semibold">{listing.title}</h3>
                <p className="text-sm font-bold">
                  {isDonation(listing.type) ? "Donación" : formatPrice(listing.price)}
                </p>
                {listing.gradeLevel ? (
                  <p className="text-xs text-muted-foreground">{listing.gradeLevel}</p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
