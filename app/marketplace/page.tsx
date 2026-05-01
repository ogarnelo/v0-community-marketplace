import { getRankedListings } from "@/lib/marketplace/get-ranked-listings";

export default async function MarketplacePage({ searchParams }: any) {
  const listings = await getRankedListings({
    q: searchParams?.q,
    category: searchParams?.category,
    grade: searchParams?.grade,
  });

  return (
    <div className="container mx-auto px-4 py-6 grid gap-4 md:grid-cols-2">
      {listings.map((l: any) => (
        <a key={l.id} href={`/marketplace/listing/${l.id}`} className="border p-4 rounded-xl">
          <h2 className="font-semibold">{l.title}</h2>
          <p className="text-sm text-muted-foreground">{l.price}€</p>
        </a>
      ))}
    </div>
  );
}
