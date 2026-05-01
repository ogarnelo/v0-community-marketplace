"use client";

import { BuyNowButton } from "@/components/marketplace/buy-now-button";
import { MakeOfferButton } from "@/components/marketplace/make-offer-button";
import { RequestDonationButton } from "@/components/marketplace/request-donation-button";

export default function MobileListingActions({
  listingId,
  price,
  isDonation,
  isAvailable,
  isOwnListing,
}: {
  listingId: string;
  price?: number | null;
  isDonation: boolean;
  isAvailable: boolean;
  isOwnListing: boolean;
}) {
  if (isOwnListing || !isAvailable) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur md:hidden">
      {isDonation ? (
        <RequestDonationButton listingId={listingId} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <MakeOfferButton listingId={listingId} currentPrice={price} />
          <BuyNowButton listingId={listingId} currentPrice={price} />
        </div>
      )}
    </div>
  );
}
