"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BookOpen, Loader2, CheckCircle2, Search, School } from "lucide-react";
import Link from "next/link";

type SchoolSearchRow = {
  id: string;
  name: string;
  city: string | null;
};

type AccessCodeResult = {
  school_id: string;
  schools: {
    id: string;
    name: string;
    city: string | null;
  } | null;
};

export default function JoinSchoolPage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<SchoolSearchRow | null>(null);
  const [error, setError] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SchoolSearchRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const loadSchools = async () => {
      if (!showSearch) return;

      setSearchLoading(true);

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("schools")
          .select("id, name, city")
          .order("name", { ascending: true })
          .limit(100);

        if (error) {
          throw error;
        }

        setSearchResults((data || []) as SchoolSearchRow[]);
      } catch (error) {
        console.error("Error cargando centros:", error);
      } finally {
        setSearchLoading(false);
      }
    };

    void loadSchools();
  }, [showSearch]);

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setFound(null);

    try {
      const normalizedCode = code.trim().toUpperCase();

      if (!normalizedCode) {
        throw new Error("Debes introducir un código.");
      }

      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign("/auth?mode=signup");
        return;
      }

      const { data, error } = await supabase
        .from("school_access_codes")
        .select("school_id, schools(id, name, city)")
        .eq("code", normalizedCode)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const result = (data as AccessCodeResult | null) ?? null;

      if (!result?.schools) {
        throw new Error(
          "No hemos encontrado ningun centro con ese codigo. Revisa y vuelve a intentarlo."
        );
      }

      setFound({
        id: result.schools.id,
        name: result.schools.name,
        city: result.schools.city,
      });
    } catch (error: any) {
      setError(
        error?.message ||
        error?.details ||
        "No se pudo validar el código del centro."
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
        window.location.assign("/auth?mode=signup");
        return;
      }

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          school_id: found.id,
        },
        { onConflict: "id" }
      );

      if (profileError) {
        throw profileError;
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          school_name: found.name,
        },
      });

      if (authError) {
        throw authError;
      }

      router.push("/marketplace");
      router.refresh();
    } catch (error: any) {
      console.error("Error uniéndose al centro:", error);
      setError(
        error?.message ||
        error?.details ||
        "No se pudo completar la unión al centro."
      );
    } finally {
      setLoading(false);
    }
  };

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
          <CardTitle className="text-2xl text-foreground">Unete a tu centro</CardTitle>
          <CardDescription>
            Introduce el codigo de tu colegio, instituto o universidad para acceder a la comunidad.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!found ? (
            <div className="flex flex-col gap-4">
              <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code">Codigo del centro</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Ej: A1B2C3D4E5"
                    className="text-center text-lg font-mono tracking-widest uppercase"
                    required
                  />
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
                  No tengo codigo, buscar centro
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
                        <div
                          key={school.id}
                          className="flex items-center gap-3 border-b border-border p-3 last:border-b-0"
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
                        </div>
                      ))
                    )}
                  </div>

                  <p className="text-center text-xs text-muted-foreground">
                    Si tu centro ya aparece, pide su código de acceso. Si no existe
                    todavía, regístralo desde el formulario de alta de centros.
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

              <Button className="w-full" onClick={handleJoin} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Unirme a {found.name}
              </Button>

              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={() => {
                  setFound(null);
                  setCode("");
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