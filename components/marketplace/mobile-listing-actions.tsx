"use client";

import { ContactSellerButton } from "@/components/messages/contact-seller-button";

function formatMobilePrice(value?: number | null) {
  if (typeof value !== "number") return "Consultar";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MobileListingActions({
  listingId,
  price,
  isDonation,
  isAvailable,
  isOwnListing,
  sellerId,
}: {
  listingId: string;
  price?: number | null;
  isDonation: boolean;
  isAvailable: boolean;
  isOwnListing: boolean;
  sellerId?: string | null;
  isProfessionalSeller?: boolean;
}) {
  if (isOwnListing || !isAvailable || !sellerId) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.1)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {isDonation ? "Donación" : "Precio"}
          </p>
          <p className="truncate text-lg font-bold leading-tight">
            {isDonation ? "Gratis" : formatMobilePrice(price)}
          </p>
        </div>

        <ContactSellerButton
          listingId={listingId}
          sellerId={sellerId}
          showIcon
          className="min-h-11 min-w-[9rem] shrink-0 gap-2 px-5"
        />
      </div>
    </div>
  );
}
