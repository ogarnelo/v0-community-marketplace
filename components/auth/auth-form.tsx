"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, Lock, User, MapPin } from "lucide-react";
import { gradeLevels } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup" | "forgot";

async function upsertProfileAfterAuth(params: {
  userId: string;
  fullName: string;
  userType: "parent" | "student" | "";
  gradeLevel: string;
  postalCode: string;
}) {
  const supabase = createClient();

  const payload = {
    id: params.userId,
    full_name: params.fullName.trim() || null,
    user_type: params.userType || null,
    grade_level: params.gradeLevel.trim() || null,
    postal_code: params.postalCode.trim() || null,
  };

  const { error } = await supabase.from("profiles").upsert(payload, {
    onConflict: "id",
  });

  if (error) {
    throw error;
  }
}

export function AuthForm() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const initialMode = useMemo<AuthMode>(
    () => (searchParams.get("mode") === "signup" ? "signup" : "login"),
    [searchParams]
  );

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    return next && next.startsWith("/") ? next : null;
  }, [searchParams]);

  const normalizedGradeLevels = useMemo(
    () => Array.from(new Set(gradeLevels)).filter(Boolean),
    []
  );

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState<"parent" | "student" | "">("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const handleForgot = async () => {
    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=login`,
      });

      if (error) throw error;

      setMode("login");
      setInfoMessage("Te hemos enviado un enlace para restablecer tu contraseña.");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo enviar el enlace. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      window.location.assign(nextPath || "/account");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo iniciar sesión. Revisa tus datos.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    const normalizedFullName = fullName.trim();
    const normalizedEmail = email.trim();
    const normalizedPostalCode = postalCode.trim();

    if (!normalizedFullName) {
      setError("El nombre completo es obligatorio.");
      return;
    }

    if (!normalizedEmail) {
      setError("El email es obligatorio.");
      return;
    }

    if (!password.trim()) {
      setError("La contraseña es obligatoria.");
      return;
    }

    if (!userType) {
      setError("Debes seleccionar un tipo de usuario.");
      return;
    }

    if (!gradeLevel) {
      setError("Debes seleccionar un curso o etapa.");
      return;
    }

    if (!/^[0-9]{5}$/.test(normalizedPostalCode)) {
      setError("Debes indicar un código postal válido de 5 dígitos.");
      return;
    }

    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);

      if (nextPath) {
        callbackUrl.searchParams.set("next", nextPath);
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: callbackUrl.toString(),
          data: {
            full_name: normalizedFullName,
            user_type: userType,
            grade_level: gradeLevel,
            postal_code: normalizedPostalCode,
          },
        },
      });

      if (error) throw error;

      if (data.user?.id) {
        await upsertProfileAfterAuth({
          userId: data.user.id,
          fullName: normalizedFullName,
          userType,
          gradeLevel,
          postalCode: normalizedPostalCode,
        });
      }

      if (data.session) {
        window.location.assign(nextPath || "/onboarding/join-school");
        return;
      }

      setInfoMessage(
        "Cuenta creada. Revisa tu email para confirmar el registro y completar el acceso."
      );
      setMode("login");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo crear la cuenta. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "forgot") return handleForgot();
    if (mode === "signup") return handleSignup();
    return handleLogin();
  };

  if (mode === "forgot") {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Recuperar contraseña</CardTitle>
          <CardDescription>
            Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {infoMessage && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                {infoMessage}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  className="pl-10"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar enlace
            </Button>

            <Button variant="ghost" type="button" className="w-full text-sm" onClick={() => setMode("login")}>
              Volver a iniciar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl text-foreground">
          {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Accede a tu cuenta para explorar el marketplace de tu centro"
            : "Regístrate gratis y únete a tu comunidad educativa"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              {infoMessage}
            </div>
          )}

          {mode === "signup" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nombre completo *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Tu nombre"
                  className="pl-10"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                className="pl-10"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              {mode === "login" && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setMode("forgot")}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="pl-10"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {mode === "signup" && (
            <>
              <div className="flex flex-col gap-2">
                <Label>Tipo de usuario *</Label>
                <Select
                  value={userType || undefined}
                  onValueChange={(v) => setUserType(v as "parent" | "student")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tu perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">Familia / Tutor legal</SelectItem>
                    <SelectItem value="student">Estudiante</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Curso / Etapa *</Label>
                <Select value={gradeLevel || undefined} onValueChange={setGradeLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {normalizedGradeLevels.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="postalCode">Código postal *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="postalCode"
                    placeholder="28001"
                    className="pl-10"
                    required
                    maxLength={5}
                    pattern="[0-9]{5}"
                    title="Introduce un código postal válido de 5 dígitos"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                ¿No tienes cuenta?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("signup")}
                >
                  Crear cuenta
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("login")}
                >
                  Iniciar sesión
                </button>
              </>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}