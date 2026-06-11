import StickyCTA from "@/components/ux/sticky-cta";

export default function ProductLayout({ listing }: any) {
  return (
    <div className="pb-24">
      <div className="aspect-square bg-muted rounded-xl mb-4" />

      <div className="space-y-2">
        <h1 className="text-xl font-bold">{listing.title}</h1>
        <p className="text-2xl font-semibold">{listing.price}€</p>
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        {listing.description}
      </div>

      <StickyCTA
        price={listing.price}
        onBuy={() => window.location.href = `/checkout?listing=${listing.id}`}
        onOffer={() => window.location.href = `/messages/new?listing=${listing.id}`}
      />
    </div>
  );
}
