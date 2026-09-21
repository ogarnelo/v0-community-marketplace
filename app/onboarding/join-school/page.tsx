"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BookOpen, Loader2, CheckCircle2, Search, School, ArrowRight } from "lucide-react";
import Link from "next/link";

type SchoolSearchRow = {
  id: string;
  name: string;
  city: string | null;
};

export default function JoinSchoolPage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [validatedCode, setValidatedCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<SchoolSearchRow | null>(null);
  const [error, setError] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SchoolSearchRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sharedSchoolLoading, setSharedSchoolLoading] = useState(true);
  const [authChoiceRequired, setAuthChoiceRequired] = useState(false);
  const [autoJoining, setAutoJoining] = useState(false);
  const autoJoinAttempted = useRef(false);
  const [attributionQuery, setAttributionQuery] = useState("");

  useEffect(() => {
    const loadSharedSchool = async () => {
      const params = new URLSearchParams(window.location.search);
      const schoolId = params.get("school")?.trim();
      const attributionParams = new URLSearchParams();
      for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
        const value = params.get(key)?.trim();
        if (value) attributionParams.set(key, value);
      }
      setAttributionQuery(attributionParams.toString());

      if (!schoolId) {
        setSharedSchoolLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/schools/public?id=${encodeURIComponent(schoolId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as {
          school?: SchoolSearchRow | null;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo cargar el centro.");
        }

        if (!payload.school) {
          setError("Este enlace de centro ya no está disponible. Puedes buscar el centro manualmente.");
          return;
        }

        setFound(payload.school);
        setShowSearch(false);
      } catch (error) {
        console.error("Error cargando centro compartido:", error);
        setError("No se pudo abrir el centro compartido. Puedes buscarlo manualmente.");
      } finally {
        setSharedSchoolLoading(false);
      }
    };

    void loadSharedSchool();
  }, []);

  useEffect(() => {
    const loadSchools = async () => {
      if (!showSearch) return;

      setSearchLoading(true);

      try {
        const response = await fetch("/api/schools/public", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          schools?: SchoolSearchRow[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "No se pudieron cargar los centros.");
        }

        setSearchResults(payload.schools || []);
      } catch (error) {
        console.error("Error cargando centros:", error);
      } finally {
        setSearchLoading(false);
      }
    };

    void loadSchools();
  }, [showSearch]);

  const skipSchoolLinking = () => {
    router.push("/marketplace");
    router.refresh();
  };

  const withAttribution = (href: string) =>
    attributionQuery ? `${href}&${attributionQuery}` : href;

  const recordSchoolJoin = async (schoolId: string) => {
    await fetch("/api/analytics/acquisition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "school_joined",
        entityId: schoolId,
      }),
      keepalive: true,
    }).catch(() => undefined);
  };

  const resolveSchoolFromId = async (schoolId: string) => {
    const response = await fetch(`/api/schools/public?id=${encodeURIComponent(schoolId)}`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      school?: SchoolSearchRow | null;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error || "No se pudo validar el centro.");
    }

    if (!payload.school) {
      throw new Error("Este centro no está disponible actualmente.");
    }

    return payload.school;
  };

  const linkCurrentUserToSchool = async (school: SchoolSearchRow) => {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Debes iniciar sesión para vincular el centro.");
    }

    const activeSchool = await resolveSchoolFromId(school.id);

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        school_id: activeSchool.id,
      },
      { onConflict: "id" }
    );

    if (profileError) throw profileError;

    const { error: authError } = await supabase.auth.updateUser({
      data: {
        school_name: activeSchool.name,
      },
    });

    if (authError) throw authError;

    return activeSchool;
  };

  const resolveSchoolFromCode = async (normalizedCode: string) => {
    const response = await fetch("/api/schools/resolve-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: normalizedCode }),
    });
    const payload = (await response.json().catch(() => null)) as {
      school?: SchoolSearchRow;
      error?: string;
    } | null;

    if (!response.ok || !payload?.school) {
      throw new Error(
        payload?.error ||
          "No hemos encontrado ningún centro con ese código. Puedes revisarlo, buscar tu centro o continuar y añadirlo más tarde."
      );
    }

    return {
      schoolId: payload.school.id,
      school: payload.school,
    };
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setFound(null);
    setValidatedCode("");

    try {
      const normalizedCode = code.trim().toUpperCase();

      if (!normalizedCode) {
        throw new Error("Introduce un código o continúa sin centro para añadirlo más tarde.");
      }

      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign(withAttribution("/auth?mode=signup"));
        return;
      }

      const result = await resolveSchoolFromCode(normalizedCode);

      setValidatedCode(normalizedCode);
      setFound(result.school);
    } catch (error: any) {
      setError(
        error?.message ||
        error?.details ||
        "No se pudo validar el código del centro. Puedes continuar y añadirlo después."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!found) return;

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAuthChoiceRequired(true);
        return;
      }

      const activeSchool = await linkCurrentUserToSchool(found);
      await recordSchoolJoin(activeSchool.id);
      router.push("/marketplace?joined=1");
      router.refresh();
    } catch (error: any) {
      console.error("Error uniéndose al centro:", error);
      setError(
        error?.message ||
        error?.details ||
        "No se pudo completar la unión al centro. Puedes continuar y añadirlo después."
      );

      if (
        typeof error?.message === "string" &&
        error.message.toLowerCase().includes("centro")
      ) {
        setFound(null);
        setValidatedCode("");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!found || autoJoinAttempted.current) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("join") !== "1") return;

    autoJoinAttempted.current = true;

    const finishPendingJoin = async () => {
      setAutoJoining(true);
      setError("");

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setAuthChoiceRequired(true);
          return;
        }

        const activeSchool = await linkCurrentUserToSchool(found);
        await recordSchoolJoin(activeSchool.id);
        router.replace("/marketplace?joined=1");
        router.refresh();
      } catch (error: any) {
        console.error("Error completando vinculación pendiente:", error);
        setError(
          error?.message ||
          error?.details ||
          "No se pudo vincular el centro después de iniciar sesión."
        );
      } finally {
        setAutoJoining(false);
      }
    };

    void finishPendingJoin();
  }, [found, router]);

  const filteredSchools = searchResults.filter((school) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return true;

    return (
      school.name.toLowerCase().includes(query) ||
      (school.city || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <BookOpen className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-mono text-xl font-bold text-foreground">Wetudy</span>
      </Link>

      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-foreground">Añade tu centro</CardTitle>
          <CardDescription>
            Te ayuda a priorizar tu comunidad educativa, pero no es obligatorio. Puedes continuar ahora y añadirlo después desde tu cuenta.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {sharedSchoolLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparando el centro...
            </div>
          ) : !found ? (
            <div className="flex flex-col gap-4">
              <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code">Código del centro</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Ej: A1B2C3D4E5"
                    className="text-center text-lg font-mono tracking-widest uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    Si no tienes el código o falla la validación, puedes saltar este paso sin perder la cuenta.
                  </p>
                </div>

                {error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Buscar centro
                </Button>
              </form>

              <Button variant="secondary" className="w-full gap-2" onClick={skipSchoolLinking}>
                Continuar sin centro por ahora
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="relative flex items-center gap-2 py-2">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">o</span>
                <div className="flex-1 border-t border-border" />
              </div>

              {!showSearch ? (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setShowSearch(true)}
                >
                  <Search className="h-4 w-4" />
                  No tengo código, buscar centro
                </Button>
              ) : (
                <div className="flex flex-col gap-3">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre o ciudad..."
                  />

                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                    {searchLoading ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Cargando centros...
                      </div>
                    ) : filteredSchools.length === 0 ? (
                      <p className="p-3 text-center text-sm text-muted-foreground">
                        No se encontraron centros
                      </p>
                    ) : (
                      filteredSchools.map((school) => (
                        <button
                          key={school.id}
                          type="button"
                          className="flex w-full items-center gap-3 border-b border-border p-3 text-left transition hover:bg-muted/50 last:border-b-0"
                          onClick={() => {
                            setFound(school);
                            setShowSearch(false);
                            setError("");
                          }}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <School className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {school.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {school.city || "Ciudad no indicada"}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <p className="text-center text-xs text-muted-foreground">
                    Si tu centro aparece, tócalo para vincular tu cuenta. Si no existe todavía, puedes registrarlo o continuar y añadirlo después.
                  </p>

                  <Link href="/register-school">
                    <Button variant="outline" className="w-full">
                      Registrar nuevo centro
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Alert className="border-secondary/30 bg-secondary/5">
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                <AlertTitle className="text-foreground">Centro encontrado</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  <strong className="text-foreground">{found.name}</strong>
                  <br />
                  {found.city || "Ciudad no indicada"}
                </AlertDescription>
              </Alert>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {autoJoining ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Vinculando tu cuenta con {found.name}...
                </div>
              ) : authChoiceRequired ? (
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="font-medium text-foreground">¿Ya tienes cuenta en Wetudy?</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Al iniciar sesión o crear tu cuenta, la vincularemos automáticamente con <strong className="text-foreground">{found.name}</strong>.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Button asChild className="w-full">
                      <Link
                        href={withAttribution(`/auth?mode=login&next=${encodeURIComponent(
                          `/onboarding/join-school?school=${found.id}&join=1`
                        )}`)}
                      >
                        Ya tengo cuenta
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                      <Link
                        href={withAttribution(`/auth?mode=signup&next=${encodeURIComponent(
                          `/onboarding/join-school?school=${found.id}&join=1`
                        )}`)}
                      >
                        Crear cuenta
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <Button className="w-full" onClick={handleJoin} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Unirme a {found.name}
                </Button>
              )}

              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={skipSchoolLinking}
                disabled={autoJoining}
              >
                Continuar sin centro por ahora
                <ArrowRight className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={() => {
                  setFound(null);
                  setCode("");
                  setValidatedCode("");
                  setAuthChoiceRequired(false);
                  setError("");
                }}
              >
                Buscar otro centro
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
