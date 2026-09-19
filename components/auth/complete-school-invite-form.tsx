"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, School } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSafeInternalPath } from "@/lib/auth/safe-next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CompleteSchoolInviteForm({ schoolName }: { schoolName?: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const destination =
    getSafeInternalPath(searchParams.get("next")) || "/admin/school";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== repeatPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: {
          school_admin_onboarding_complete: true,
        },
      });
      if (updateError) throw updateError;
      router.replace(destination);
      router.refresh();
    } catch (cause: any) {
      setError(cause?.message || "No se pudo completar la activación.");
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
          {schoolName
            ? `Crea una contraseña para administrar ${schoolName} en Wetudy.`
            : "Crea una contraseña para completar el acceso de administración del centro."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            Esta misma cuenta también funciona como una cuenta normal de Wetudy: podrás publicar anuncios,
            usar el chat y acordar entregas directamente, además de acceder al panel del centro.
          </div>

          {error ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="school-invite-password">Contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="school-invite-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="pl-10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="school-invite-password-repeat">Repite la contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="school-invite-password-repeat"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="pl-10"
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Crear contraseña y entrar al panel
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
