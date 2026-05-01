"use client";

import { useEffect } from "react";
import { MarketplaceEvents } from "@/lib/analytics/events";
import { trackMarketplaceEvent } from "@/lib/analytics/track-client";

export default function ListingViewTracker({
  listingId,
  sellerId,
  category,
  gradeLevel,
}: {
  listingId: string;
  sellerId?: string | null;
  category?: string | null;
  gradeLevel?: string | null;
}) {
  useEffect(() => {
    void trackMarketplaceEvent({
      eventName: MarketplaceEvents.ListingViewed,
      entityType: "listing",
      entityId: listingId,
      properties: {
        seller_id: sellerId,
        category,
        grade_level: gradeLevel,
      },
    });
  }, [category, gradeLevel, listingId, sellerId]);

  return null;
}
