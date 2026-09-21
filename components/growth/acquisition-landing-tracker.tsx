"use client";

import { useEffect } from "react";
import { attributionFromSearchParams, cleanReferrerHost } from "@/lib/growth/attribution";

export function AcquisitionLandingTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let referrerHost: string | null = null;

    if (document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.host !== window.location.host) {
          referrerHost = cleanReferrerHost(referrer.host);
        }
      } catch {
        referrerHost = null;
      }
    }

    const utm = attributionFromSearchParams(params, {
      landingPath: window.location.pathname,
      referrerHost,
    });

    const attribution =
      utm ||
      (referrerHost
        ? {
            source: referrerHost,
            medium: "referral",
            campaign: null,
            content: null,
            landingPath: window.location.pathname,
            referrerHost,
          }
        : null);

    if (!attribution) return;

    const body = JSON.stringify(attribution);

    void fetch("/api/analytics/acquisition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...attribution, eventType: "landing" }),
      keepalive: true,
    }).catch(() => undefined);

    void fetch("/api/analytics/acquisition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...JSON.parse(body), eventType: "attributed_user" }),
      keepalive: true,
    }).catch(() => undefined);
  }, []);

  return null;
}
