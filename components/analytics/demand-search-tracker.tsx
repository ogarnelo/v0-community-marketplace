"use client";

import { useEffect } from "react";

export default function DemandSearchTracker({
  query,
  category,
  gradeLevel,
  condition,
  listingType,
  isbn,
  resultCount,
}: {
  query?: string | null;
  category?: string | null;
  gradeLevel?: string | null;
  condition?: string | null;
  listingType?: string | null;
  isbn?: string | null;
  resultCount: number;
}) {
  useEffect(() => {
    const hasDemandSignal = Boolean(query || category || gradeLevel || condition || listingType || isbn);
    const eventType = hasDemandSignal
      ? resultCount === 0
        ? "zero_result_search"
        : "search_performed"
      : "marketplace_browse";

    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      void fetch("/api/demand/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          eventType,
          query,
          category,
          gradeLevel,
          condition,
          listingType,
          isbn,
          resultCount,
          source: "marketplace",
          route: "/marketplace",
        }),
      }).catch(() => null);
    }, 750);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, category, gradeLevel, condition, listingType, isbn, resultCount]);

  return null;
}
