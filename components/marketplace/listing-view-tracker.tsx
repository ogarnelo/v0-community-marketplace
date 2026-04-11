"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function getOrCreateSessionId() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem("wetudy-session-id");

  if (existing) return existing;

  const created =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem("wetudy-session-id", created);
  return created;
}

export function ListingViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    let cancelled = false;

    const trackView = async () => {
      try {
        const sessionId = getOrCreateSessionId();
        const sessionStorageKey = `wetudy-viewed-listing:${listingId}:${sessionId}`;

        if (window.sessionStorage.getItem(sessionStorageKey)) {
          return;
        }

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        const { error } = await supabase.from("listing_views").insert({
          listing_id: listingId,
          viewer_id: user?.id || null,
          session_id: sessionId,
        });

        if (error) {
          console.error("Error registrando visita de listing:", error);
          return;
        }

        window.sessionStorage.setItem(sessionStorageKey, "1");
      } catch (error) {
        console.error("Error en tracking de visita:", error);
      }
    };

    void trackView();

    return () => {
      cancelled = true;
    };
  }, [listingId]);

  return null;
}