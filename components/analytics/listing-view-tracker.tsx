"use client";

import { useEffect } from "react";

type ListingViewTrackerProps = {
  listingId: string;
  sellerId?: string | null;
  category?: string | null;
  gradeLevel?: string | null;
};

export default function ListingViewTracker({
  listingId,
  sellerId,
  category,
  gradeLevel,
}: ListingViewTrackerProps) {
  useEffect(() => {
    if (!listingId) return;

    const payload = JSON.stringify({
      event_name: "listing_view",
      entity_type: "listing",
      entity_id: listingId,
      metadata: {
        seller_id: sellerId || null,
        category: category || null,
        grade_level: gradeLevel || null,
      },
    });

    const endpoint = "/api/marketplace/events";

    try {
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(endpoint, blob);
        return;
      }

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Analytics should never block the listing page.
      });
    } catch {
      // No-op.
    }
  }, [listingId, sellerId, category, gradeLevel]);

  return null;
}
