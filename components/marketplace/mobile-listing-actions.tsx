"use client";

import Link from "next/link";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { BuyNowButton } from "@/components/marketplace/buy-now-button";
import { MakeOfferButton } from "@/components/marketplace/make-offer-button";
import { RequestDonationButton } from "@/components/marketplace/request-donation-button";
import { Button } from "@/components/ui/button";

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
  isProfessionalSeller,
}: {
  listingId: string;
  price?: number | null;
  isDonation: boolean;
  isAvailable: boolean;
  isOwnListing: boolean;
  isProfessionalSeller?: boolean;
}) {
  if (isOwnListing || !isAvailable) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] pt-2.5 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur md:hidden">
      <div className="mx-auto max-w-md">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              {isDonation ? "Donación disponible" : "Precio"}
            </p>
            <p className="truncate text-base font-bold">
              {isDonation ? "Gratis" : formatMobilePrice(price)}
            </p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Pago y chat protegidos
          </div>
        </div>

        {isDonation ? (
          <div className="grid grid-cols-[0.85fr_1.15fr] gap-2">
            <Button asChild size="lg" variant="secondary" className="w-full gap-2">
              <Link href={`/messages?listing=${listingId}`}>
                <MessageCircle className="h-4 w-4" />
                Chat
              </Link>
            </Button>
            <RequestDonationButton listingId={listingId} />
          </div>
        ) : isProfessionalSeller ? (
          <div className="grid grid-cols-[0.9fr_1.1fr] gap-2">
            <Button asChild size="lg" variant="secondary" className="w-full gap-2 px-2">
              <Link href={`/messages?listing=${listingId}`}>
                <MessageCircle className="h-4 w-4" />
                Chat
              </Link>
            </Button>
            <BuyNowButton listingId={listingId} currentPrice={price} />
          </div>
        ) : (
          <div className="grid grid-cols-[0.8fr_1fr_1.05fr] gap-2">
            <Button asChild size="lg" variant="secondary" className="w-full gap-2 px-2">
              <Link href={`/messages?listing=${listingId}`}>
                <MessageCircle className="h-4 w-4" />
                Chat
              </Link>
            </Button>
            <MakeOfferButton listingId={listingId} currentPrice={price} />
            <BuyNowButton listingId={listingId} currentPrice={price} />
          </div>
        )}
      </div>
    </div>
  );
}
