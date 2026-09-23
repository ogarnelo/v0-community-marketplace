"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SchoolInviteActivation() {
  const searchParams = useSearchParams();
  const tokenHash = useMemo(() => searchParams.get("token_hash")?.trim() || "", [searchParams]);
  const type = useMemo(() => searchParams.get("type")?.trim() || "", [searchParams]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activate = async () => {
    if (!tokenHash || (type !== "invite" && type !== "magiclink")) {
      setError("Este enlace de activación no es válido. Solicita uno nuevo.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/activate-school-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenHash, type }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; next?: string; error?: string }
        | null;

      if (!response.ok || !payload?.ok || !payload.next) {
        throw new Error(
          payload?.error ||
            "El enlace de activación no es válido o ha caducado. Solicita uno nuevo."
        );
      }

      window.location.assign(payload.next);
    } catch (cause: any) {
      setError(
        cause?.message ||
          "El enlace de activación no es válido o ha caducado. Solicita uno nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <School className="h-5 w-5" />
        </div>
        <CardTitle className="text-2xl">Activa el acceso de tu centro</CardTitle>
        <CardDescription>
          Confirma la activación y, a continuación, podrás crear tu contraseña para entrar al panel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Por seguridad, el enlace no se activa automáticamente al abrir el correo. Así evitamos que
            los sistemas de protección del email consuman la invitación antes de que la uses.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        ) : null}

        <Button type="button" className="w-full" onClick={() => void activate()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Activar acceso y crear contraseña
        </Button>
      </CardContent>
    </Card>
  );
}
