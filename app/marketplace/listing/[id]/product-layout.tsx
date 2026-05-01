"use client";

import StickyCTA from "@/components/ux/sticky-cta";

export default function ProductLayout({ listing }: { listing: { id: string; title?: string | null; price?: number | null; description?: string | null } }) {
  const price = typeof listing.price === "number" ? listing.price : 0;

  return (
    <div className="pb-24">
      <div className="mb-4 aspect-square rounded-xl bg-muted" />

      <div className="space-y-2">
        <h1 className="text-xl font-bold">{listing.title || "Anuncio"}</h1>
        {typeof listing.price === "number" ? <p className="text-2xl font-semibold">{listing.price}€</p> : null}
      </div>

      {listing.description ? (
        <div className="mt-4 text-sm text-muted-foreground">{listing.description}</div>
      ) : null}

      <StickyCTA
        price={price}
        onBuy={() => window.location.assign(`/marketplace/listing/${listing.id}`)}
        onOffer={() => window.location.assign(`/marketplace/listing/${listing.id}`)}
      />
    </div>
  );
}
