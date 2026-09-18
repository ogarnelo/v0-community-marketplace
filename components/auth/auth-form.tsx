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
import { buildFullName, normalizeNamePart } from "@/lib/users/person-name";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { getAuthErrorMessage } from "@/lib/auth/error-messages";
import { getSafeInternalPath } from "@/lib/auth/safe-next";

const DEFAULT_TURNSTILE_SITE_KEY = "0x4AAAAAAE69ijg1KI5Aks-p";
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || DEFAULT_TURNSTILE_SITE_KEY;

type AuthMode = "login" | "signup" | "forgot" | "resend";
type SupportedSignupUserType = "parent" | "student" | "";

async function upsertProfileAfterAuth(params: {
  userId: string;
  firstName: string;
  lastName: string;
  userType: SupportedSignupUserType;
  gradeLevel: string;
  postalCode: string;
}) {
  const supabase = createClient();
  const fullName = buildFullName(params.firstName, params.lastName);

  const payload = {
    id: params.userId,
    first_name: normalizeNamePart(params.firstName) || null,
    last_name: normalizeNamePart(params.lastName) || null,
    full_name: fullName,
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

async function triggerWelcomeEmail() {
  try {
    await fetch("/api/emails/welcome", { method: "POST" });
  } catch (error) {
    console.warn("No se pudo solicitar el email de bienvenida", error);
  }
}

export function AuthForm() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const initialMode = useMemo<AuthMode>(() => {
    const requestedMode = searchParams.get("mode");

    if (
      requestedMode === "signup" ||
      requestedMode === "forgot" ||
      requestedMode === "resend"
    ) {
      return requestedMode;
    }

    return "login";
  }, [searchParams]);

  const nextPath = useMemo(
    () => getSafeInternalPath(searchParams.get("next")),
    [searchParams]
  );

  const normalizedGradeLevels = useMemo(
    () => Array.from(new Set(gradeLevels)).filter(Boolean),
    []
  );

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState<SupportedSignupUserType>("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const captchaIsRequired = Boolean(TURNSTILE_SITE_KEY);

  const requireCaptchaToken = () => {
    if (captchaIsRequired && !captchaToken) {
      setError("Completa la verificación de seguridad.");
      return false;
    }

    return true;
  };

  const resetCaptcha = () => {
    if (!captchaIsRequired) return;
    setCaptchaToken(null);
    setCaptchaResetKey((value) => value + 1);
  };

  const handleForgot = async () => {
    if (!requireCaptchaToken()) return;

    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      const recoveryCallbackUrl = new URL("/auth/callback", window.location.origin);
      recoveryCallbackUrl.searchParams.set("next", "/auth/update-password");

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryCallbackUrl.toString(),
        ...(captchaToken ? { captchaToken } : {}),
      });

      if (error) throw error;

      setMode("login");
      setInfoMessage("Te hemos enviado un enlace para restablecer tu contraseña.");
    } catch (e: any) {
      setError(getAuthErrorMessage(e, "forgot"));
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Introduce el email con el que creaste la cuenta.");
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

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: callbackUrl.toString(),
        },
      });

      if (error) throw error;

      setInfoMessage(
        "Si existe una cuenta pendiente de activar con ese email, hemos reenviado el enlace de confirmación. Revisa también Spam o Correo no deseado."
      );
      setMode("login");
    } catch (e: any) {
      setError(getAuthErrorMessage(e, "signup"));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!requireCaptchaToken()) return;

    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: captchaToken ? { captchaToken } : undefined,
      });
      if (error) throw error;

      await triggerWelcomeEmail();
      window.location.assign(nextPath || "/account");
    } catch (e: any) {
      setError(getAuthErrorMessage(e, "login"));
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    const normalizedFirstName = normalizeNamePart(firstName);
    const normalizedLastName = normalizeNamePart(lastName);
    const normalizedFullName = buildFullName(normalizedFirstName, normalizedLastName);
    const normalizedEmail = email.trim();
    const normalizedPostalCode = postalCode.trim();

    if (!normalizedFirstName) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (!normalizedLastName) {
      setError("Los apellidos son obligatorios.");
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

    if (!requireCaptchaToken()) return;

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
          captchaToken: captchaToken || undefined,
          data: {
            first_name: normalizedFirstName,
            last_name: normalizedLastName,
            full_name: normalizedFullName,
            user_type: userType,
            grade_level: gradeLevel,
            postal_code: normalizedPostalCode,
          },
        },
      });

      if (error) throw error;

      if (data.user?.id && data.session) {
        await upsertProfileAfterAuth({
          userId: data.user.id,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          userType,
          gradeLevel,
          postalCode: normalizedPostalCode,
        });
      }

      if (data.session) {
        await triggerWelcomeEmail();
        window.location.assign(nextPath || "/onboarding/join-school");
        return;
      }

      setInfoMessage(
        "Cuenta creada. Te hemos enviado un email de confirmación. Abre el enlace para activar tu cuenta. Si no lo ves en unos minutos, revisa Spam o Correo no deseado. Después podrás iniciar sesión."
      );
      setMode("login");
    } catch (e: any) {
      setError(getAuthErrorMessage(e, "signup"));
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "forgot") return handleForgot();
    if (mode === "resend") return handleResendConfirmation();
    if (mode === "signup") return handleSignup();
    return handleLogin();
  };

  if (mode === "resend") {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Reenviar activación</CardTitle>
          <CardDescription>
            Introduce tu email y te enviaremos de nuevo el enlace para activar la cuenta.
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
              <Label htmlFor="resend-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="resend-email"
                  type="email"
                  autoComplete="email"
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
              Reenviar email de activación
            </Button>

            <Button
              variant="ghost"
              type="button"
              className="w-full text-sm"
              onClick={() => {
                setError("");
                setMode("login");
              }}
            >
              Volver a iniciar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

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

            {captchaIsRequired ? (
              <TurnstileWidget
                key={`forgot-${captchaResetKey}`}
                siteKey={TURNSTILE_SITE_KEY}
                onTokenChange={setCaptchaToken}
              />
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || (captchaIsRequired && !captchaToken)}
            >
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
            ? "Accede a tu cuenta para explorar Wetudy"
            : "Regístrate gratis como familia o estudiante"}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="firstName">Nombre *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="firstName"
                    autoComplete="given-name"
                    placeholder="Nombre"
                    className="pl-10"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="lastName">Apellidos *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="lastName"
                    autoComplete="family-name"
                    placeholder="Apellidos"
                    className="pl-10"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
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
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Contraseña</Label>
              {mode === "login" && (
                <button
                  type="button"
                  className="shrink-0 text-xs text-primary hover:underline"
                  onClick={() => {
                    setError("");
                    setInfoMessage("");
                    setMode("forgot");
                  }}
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
                  onValueChange={(v) => setUserType(v as SupportedSignupUserType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona tu perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">Familia / Tutor legal</SelectItem>
                    <SelectItem value="student">Estudiante</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Las cuentas de vendedor profesional no están activas durante el MVP.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Curso / Etapa *</Label>
                <Select value={gradeLevel || undefined} onValueChange={setGradeLevel}>
                  <SelectTrigger className="w-full">
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
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="28001"
                    className="pl-10"
                    required
                    maxLength={5}
                    pattern="[0-9]{5}"
                    title="Introduce un código postal válido de 5 dígitos"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                Al crear tu cuenta, te enviaremos un email de confirmación. Tendrás que abrir el enlace para activar tu cuenta. Si no lo ves en unos minutos, revisa también la carpeta de Spam o Correo no deseado.
              </div>
            </>
          )}

          {captchaIsRequired ? (
            <TurnstileWidget
              key={`${mode}-${captchaResetKey}`}
              siteKey={TURNSTILE_SITE_KEY}
              onTokenChange={setCaptchaToken}
            />
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || (captchaIsRequired && !captchaToken)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </Button>

          <div className="space-y-2 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                <div>
                  ¿No tienes cuenta?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => {
                      setError("");
                      setInfoMessage("");
                      setMode("signup");
                    }}
                  >
                    Crear cuenta
                  </button>
                </div>
                <div>
                  ¿No recibiste el email de activación?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => {
                      setError("");
                      setInfoMessage("");
                      setMode("resend");
                    }}
                  >
                    Reenviarlo
                  </button>
                </div>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => {
                    setError("");
                    setInfoMessage("");
                    setMode("login");
                  }}
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
