
import Link from "next/link";

export default function RelatedListings({ listings }: { listings: any[] }) {
  if (!listings.length) return null;

  return (
    <div className="mt-10">
      <h3 className="text-lg font-semibold mb-4">Productos relacionados</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {listings.map((l) => (
          <Link key={l.id} href={`/marketplace/listing/${l.id}`} className="border rounded-xl p-3 hover:shadow">
            <p className="text-sm font-medium line-clamp-2">{l.title}</p>
            <p className="text-sm text-muted-foreground">{l.price}€</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
