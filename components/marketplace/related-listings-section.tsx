
import { ListingCard } from "@/components/listing-card";
import type { MarketplaceListing } from "@/lib/types/marketplace";

export default function RelatedListingsSection({
  listings,
  currentSchoolId = "",
}: {
  listings: MarketplaceListing[];
  currentSchoolId?: string;
}) {
  if (listings.length === 0) return null;

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">También puede interesarte</h2>
        <p className="text-sm text-muted-foreground">
          Anuncios similares por categoría, curso o ISBN.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} currentSchoolId={currentSchoolId} />
        ))}
      </div>
    </section>
  );
}
