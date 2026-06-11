"use client";

import type { TrackEventPayload } from "@/lib/analytics/events";

export async function trackMarketplaceEvent(payload: TrackEventPayload) {
  try {
    await fetch("/api/analytics/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Analytics should never break UX.
  }
}
