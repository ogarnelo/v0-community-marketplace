"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ConnectState = {
  id: string;
  type: string | null;
  country: string | null;
  defaultCurrency: string | null;
  onboardingStatus: "pending" | "restricted" | "ready" | "disabled";
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  transfersActive: boolean;
  currentlyDue: string[];
  eventuallyDue: string[];
};

export function SellerConnectPreviewCard() {
  const [state, setState] = useState<ConnectState | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/commerce/connect/account", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo cargar Stripe Connect.");
      }
      setState(payload.account || null);
    } catch (error: any) {
      setError(error?.message || "No se pudo cargar Stripe Connect.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openOnboarding = async () => {
    setOpening(true);
    setError("");
    try {
      const response = await fetch("/api/commerce/connect/account", {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "No se pudo abrir la verificación.");
      }
      window.location.assign(payload.url);
    } catch (error: any) {
      setError(error?.message || "No se pudo abrir la verificación.");
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando estado de Stripe Connect...
        </CardContent>
      </Card>
    );
  }

  const ready = state?.onboardingStatus === "ready";

  return (
    <Card className={ready ? "border-emerald-200" : "border-amber-200"}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Cobros del vendedor · Stripe test
            </CardTitle>
            <CardDescription>
              Solo para la beta privada. No activa cobros ni transferencias reales.
            </CardDescription>
          </div>
          <Badge variant={ready ? "secondary" : "outline"}>
            {ready ? "Listo para transferencias test" : "Verificación pendiente"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {state ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-3 text-sm">
              <p className="text-xs text-muted-foreground">Cuenta Stripe</p>
              <p className="mt-1 font-mono text-xs">{state.id}</p>
            </div>
            <div className="rounded-xl border p-3 text-sm">
              <p className="text-xs text-muted-foreground">Transfers</p>
              <p className="mt-1 font-medium">
                {state.transfersActive ? "Activa" : "Pendiente"}
              </p>
            </div>
            <div className="rounded-xl border p-3 text-sm">
              <p className="text-xs text-muted-foreground">Datos enviados</p>
              <p className="mt-1 font-medium">
                {state.detailsSubmitted ? "Sí" : "No"}
              </p>
            </div>
            <div className="rounded-xl border p-3 text-sm">
              <p className="text-xs text-muted-foreground">Payouts</p>
              <p className="mt-1 font-medium">
                {state.payoutsEnabled ? "Activos" : "Pendientes"}
              </p>
            </div>
          </div>
        ) : null}

        {state?.currentlyDue?.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-medium">Stripe todavía solicita información</p>
            <p className="mt-1 text-xs leading-5">
              {state.currentlyDue.slice(0, 6).join(" · ")}
            </p>
          </div>
        ) : ready ? (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            La cuenta de prueba está preparada para recibir transferencias Stripe test.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={openOnboarding} disabled={opening}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {opening
              ? "Abriendo Stripe..."
              : ready
                ? "Revisar datos en Stripe"
                : "Completar verificación test"}
          </Button>
          <Button type="button" variant="outline" onClick={load}>
            Actualizar estado
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
