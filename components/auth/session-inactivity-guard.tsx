"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const ADMIN_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const USER_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const ACTIVITY_WRITE_THROTTLE_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

type SessionPolicyResponse = {
  timeoutMs?: number;
};

export function SessionInactivityGuard() {
  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let intervalId: number | null = null;
    let activityKey = "";
    let timeoutMs = USER_TIMEOUT_MS;
    let lastWriteAt = 0;
    let signingOut = false;

    const signOutForInactivity = async () => {
      if (signingOut || disposed) return;
      signingOut = true;

      try {
        if (activityKey) {
          window.localStorage.removeItem(activityKey);
        }

        await fetch("/api/auth/signout", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        }).catch(() => undefined);

        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      } finally {
        window.location.assign("/auth?reason=inactive");
      }
    };

    const readLastActivity = () => {
      if (!activityKey) return Date.now();
      const raw = window.localStorage.getItem(activityKey);
      const parsed = raw ? Number(raw) : NaN;
      return Number.isFinite(parsed) ? parsed : Date.now();
    };

    const checkInactivity = async () => {
      if (!activityKey || disposed) return;
      const lastActivity = readLastActivity();

      if (Date.now() - lastActivity >= timeoutMs) {
        await signOutForInactivity();
      }
    };

    const recordActivity = () => {
      if (!activityKey || disposed || signingOut) return;

      const now = Date.now();
      if (now - lastWriteAt < ACTIVITY_WRITE_THROTTLE_MS) return;

      lastWriteAt = now;
      window.localStorage.setItem(activityKey, String(now));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkInactivity();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === activityKey && event.newValue) {
        void checkInactivity();
      }
    };

    const initialize = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || disposed) return;

      activityKey = `wetudy:last-activity:${user.id}`;

      try {
        const response = await fetch("/api/auth/session-policy", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (response.ok) {
          const payload = (await response.json()) as SessionPolicyResponse;
          if (
            typeof payload.timeoutMs === "number" &&
            payload.timeoutMs >= ADMIN_TIMEOUT_MS &&
            payload.timeoutMs <= USER_TIMEOUT_MS
          ) {
            timeoutMs = payload.timeoutMs;
          }
        } else {
          timeoutMs = ADMIN_TIMEOUT_MS;
        }
      } catch {
        timeoutMs = ADMIN_TIMEOUT_MS;
      }

      const storedActivity = window.localStorage.getItem(activityKey);
      const parsedActivity = storedActivity ? Number(storedActivity) : NaN;
      const now = Date.now();

      if (Number.isFinite(parsedActivity) && now - parsedActivity >= timeoutMs) {
        await signOutForInactivity();
        return;
      }

      // A navigation/refresh counts as activity only after we have verified
      // that the previous session did not already exceed the inactivity limit.
      lastWriteAt = now;
      window.localStorage.setItem(activityKey, String(now));

      const activityEvents: Array<keyof WindowEventMap> = [
        "pointerdown",
        "keydown",
        "touchstart",
        "scroll",
      ];

      activityEvents.forEach((eventName) => {
        window.addEventListener(eventName, recordActivity, { passive: true });
      });
      window.addEventListener("focus", checkInactivity);
      window.addEventListener("storage", handleStorage);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      intervalId = window.setInterval(() => {
        void checkInactivity();
      }, CHECK_INTERVAL_MS);

      return () => {
        activityEvents.forEach((eventName) => {
          window.removeEventListener(eventName, recordActivity);
        });
        window.removeEventListener("focus", checkInactivity);
        window.removeEventListener("storage", handleStorage);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    };

    let cleanupListeners: (() => void) | undefined;
    void initialize().then((cleanup) => {
      cleanupListeners = cleanup;
    });

    return () => {
      disposed = true;
      cleanupListeners?.();
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  return null;
}
