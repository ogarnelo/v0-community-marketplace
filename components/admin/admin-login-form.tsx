"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Mail, Lock, ShieldCheck, ArrowLeft } from "lucide-react";

export function AdminLoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        throw new Error("Debes indicar el email del administrador.");
      }

      if (!password) {
        throw new Error("Debes indicar la contraseña.");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error("No se pudo recuperar la sesión del administrador.");
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, school_id")
        .eq("user_id", user.id);

      const hasSuperAdmin = (roles || []).some((role) => role.role === "super_admin");
      const hasSchoolAdmin = (roles || []).some((role) => role.role === "school_admin");
      const isProvisionalSuperAdmin =
        normalizedEmail === "oscar_garnelo@hotmail.com";

      if (hasSuperAdmin || isProvisionalSuperAdmin) {
        router.push("/admin/super");
        router.refresh();
        return;
      }

      if (hasSchoolAdmin) {
        router.push("/admin/school");
        router.refresh();
        return;
      }

      throw new Error(
        "Tu usuario no tiene permisos de administración asignados todavía."
      );
    } catch (error: any) {
      console.error("Error en admin login:", error);
      setError(
        error?.message ||
        error?.details ||
        "No se pudo acceder al panel de administración."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 lg:px-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al inicio
      </Link>

      <Card className="border-border">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="mt-2 text-2xl text-foreground">
            Panel Colegio / AMPA
          </CardTitle>
          <CardDescription className="leading-relaxed">
            Accede al panel de administracion de tu centro educativo para gestionar
            anuncios, donaciones y miembros.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error ? (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email del administrador</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@colegio.es"
                  className="pl-10"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contrasena</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  className="pl-10"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Acceder al panel
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Tu centro aun no esta registrado?{" "}
                <Link href="/register-school" className="font-medium text-primary hover:underline">
                  Solicitar acceso
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}