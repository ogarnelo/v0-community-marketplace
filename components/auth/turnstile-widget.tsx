"use client";

import { useEffect, useRef } from "react";

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  theme?: "auto" | "light" | "dark";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

type TurnstileApi = {
  render: (element: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = "wetudy-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function TurnstileWidget({
  siteKey,
  onTokenChange,
}: {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;

    let cancelled = false;
    let script = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;

    onTokenChange(null);

    const removeWidget = () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };

    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;

      removeWidget();
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: "auth",
        theme: "auto",
        callback: (token) => onTokenChange(token),
        "expired-callback": () => onTokenChange(null),
        "error-callback": () => onTokenChange(null),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else if (script) {
      script.addEventListener("load", renderWidget, { once: true });
    } else {
      script = document.createElement("script");
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderWidget, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", renderWidget);
      removeWidget();
    };
  }, [onTokenChange, siteKey]);

  if (!siteKey) return null;

  return (
    <div className="flex min-h-[65px] w-full items-center justify-center overflow-hidden">
      <div ref={containerRef} aria-label="Verificación de seguridad" />
    </div>
  );
}
