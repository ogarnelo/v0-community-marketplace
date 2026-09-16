"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";

export default function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError("");
    setSuccess(false);

    if (password.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) throw updateError;

      setPassword("");
      setConfirmation("");
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "No se pudo cambiar la contraseña. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <CardTitle>Cambiar contraseña</CardTitle>
        <CardDescription>
          Define una nueva contraseña para tu cuenta. Debe tener al menos 8 caracteres.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Repite la nueva contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Repite la contraseña"
              required
              minLength={8}
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Contraseña actualizada correctamente.
            </p>
          ) : null}

          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar nueva contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
