"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, CheckCircle2, GraduationCap, Plus, Search, Sparkles, Trash2 } from "lucide-react";

type SchoolOption = { id: string; name: string; city: string | null };
type ListingSummary = {
  id: string;
  title: string;
  category: string | null;
  gradeLevel: string | null;
  isbn: string | null;
  schoolId: string | null;
  price: number | null;
  listingType: string | null;
};

type Learner = {
  id: string;
  label: string;
  schoolId: string;
  gradeLevel: string;
  academicYear: string;
};

type Need = {
  id: string;
  learnerId: string;
  title: string;
  isbn: string;
  category: string;
  createdAt: string;
};

type LocalState = { learners: Learner[]; needs: Need[] };

const STORAGE_KEY = "wetudy_my_course_beta_v0";

function normalizeText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeIsbn(value?: string | null) {
  return (value || "").replace(/[^0-9xX]/g, "").toLowerCase();
}

function safeId(prefix: string) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

export default function MyCourseBetaClient({
  schools,
  gradeLevels,
  listings,
}: {
  schools: SchoolOption[];
  gradeLevels: string[];
  listings: ListingSummary[];
}) {
  const [state, setState] = useState<LocalState>({ learners: [], needs: [] });
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.learners) && Array.isArray(parsed?.needs)) {
          setState({ learners: parsed.learners, needs: parsed.needs });
        }
      }
    } catch {
      // La beta debe seguir funcionando aunque el almacenamiento local falle.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const schoolById = useMemo(() => new Map(schools.map((school) => [school.id, school])), [schools]);

  function matchesForNeed(need: Need, learner: Learner) {
    const wantedIsbn = normalizeIsbn(need.isbn);
    const wantedTitle = normalizeText(need.title);

    return listings
      .filter((listing) => {
        if (wantedIsbn) return normalizeIsbn(listing.isbn) === wantedIsbn;
        if (!wantedTitle) return false;
        return [
          listing.title,
          listing.category,
          listing.gradeLevel,
          listing.isbn,
        ].some((value) => normalizeText(value).includes(wantedTitle));
      })
      .sort((a, b) => {
        const aSchool = a.schoolId === learner.schoolId ? 1 : 0;
        const bSchool = b.schoolId === learner.schoolId ? 1 : 0;
        if (aSchool !== bSchool) return bSchool - aSchool;

        const aGrade = a.gradeLevel === learner.gradeLevel ? 1 : 0;
        const bGrade = b.gradeLevel === learner.gradeLevel ? 1 : 0;
        return bGrade - aGrade;
      });
  }

  function createLearner(formData: FormData) {
    const schoolId = String(formData.get("schoolId") || "");
    const gradeLevel = String(formData.get("gradeLevel") || "");
    if (!schoolId || !gradeLevel) return;

    const learner: Learner = {
      id: safeId("learner"),
      label: String(formData.get("label") || "Hijo/a").trim() || "Hijo/a",
      schoolId,
      gradeLevel,
      academicYear: String(formData.get("academicYear") || "2026/27"),
    };

    setState((current) => ({ ...current, learners: [...current.learners, learner] }));
    setMessage("Curso añadido en esta beta local.");
  }

  function createNeed(learnerId: string, formData: FormData) {
    const title = String(formData.get("title") || "").trim();
    const isbn = String(formData.get("isbn") || "").trim();
    if (!title && !isbn) return;

    const need: Need = {
      id: safeId("need"),
      learnerId,
      title: title || isbn,
      isbn,
      category: String(formData.get("category") || "Libros de texto"),
      createdAt: new Date().toISOString(),
    };

    setState((current) => ({ ...current, needs: [need, ...current.needs] }));
    setMessage("Necesidad guardada solo en este navegador.");
  }

  function removeNeed(id: string) {
    setState((current) => ({ ...current, needs: current.needs.filter((need) => need.id !== id) }));
  }

  function resetBeta() {
    setState({ learners: [], needs: [] });
    setMessage("Datos locales de la beta eliminados.");
  }

  if (!hydrated) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Preparando Mi curso…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <div className="mb-6 rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Beta sin impacto en producción</Badge>
          <Badge variant="outline">Mi curso</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">Prepara el curso sin buscarlo todo desde cero</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Esta versión guarda hijos y necesidades únicamente en tu navegador y consulta en modo lectura los anuncios reales ya publicados en Wetudy.
        </p>
      </div>

      {message ? <div className="mb-5 rounded-2xl border bg-muted/30 px-4 py-3 text-sm">{message}</div> : null}

      {state.learners.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Añade el primer curso</CardTitle>
            <CardDescription>No necesitamos datos personales del menor. Basta una etiqueta, el centro y el curso.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createLearner} className="grid gap-3 sm:grid-cols-2">
              <input name="label" defaultValue="Hijo/a 1" maxLength={80} className="h-11 rounded-md border bg-background px-3" />
              <select name="schoolId" required className="h-11 rounded-md border bg-background px-3">
                <option value="">Selecciona centro</option>
                {schools.map((school) => <option key={school.id} value={school.id}>{school.name}{school.city ? " · " + school.city : ""}</option>)}
              </select>
              <select name="gradeLevel" required className="h-11 rounded-md border bg-background px-3">
                <option value="">Selecciona curso</option>
                {gradeLevels.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
              </select>
              <select name="academicYear" defaultValue="2026/27" className="h-11 rounded-md border bg-background px-3">
                <option value="2026/27">2026/27</option>
                <option value="2027/28">2027/28</option>
              </select>
              <Button type="submit" className="sm:col-span-2"><Plus className="mr-2 h-4 w-4" />Crear Mi curso</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {state.learners.map((learner) => {
            const learnerNeeds = state.needs.filter((need) => need.learnerId === learner.id);
            const resolved = learnerNeeds.filter((need) => matchesForNeed(need, learner).length > 0).length;
            const school = schoolById.get(learner.schoolId);

            return (
              <Card key={learner.id}>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{learner.label}</CardTitle>
                      <CardDescription>{school?.name || "Centro"} · {learner.gradeLevel} · {learner.academicYear}</CardDescription>
                    </div>
                    <Badge variant="outline">{resolved}/{learnerNeeds.length} con opciones</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {learnerNeeds.length ? (
                    <div className="space-y-3">
                      {learnerNeeds.map((need) => {
                        const matches = matchesForNeed(need, learner);
                        const best = matches[0];

                        return (
                          <div key={need.id} className="rounded-2xl border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  {best ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Search className="h-4 w-4 text-muted-foreground" />}
                                  <p className="font-medium">{need.title}</p>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {need.isbn ? "ISBN " + need.isbn + " · " : ""}
                                  {best ? matches.length + " opción/es encontradas" : "Todavía no aparece en los anuncios actuales"}
                                </p>
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeNeed(need.id)} aria-label="Eliminar necesidad">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {best ? (
                              <div className="mt-3 flex flex-col gap-2 rounded-xl bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-medium">{best.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {best.schoolId === learner.schoolId ? "Tu centro · " : ""}
                                    {best.price != null ? best.price + " €" : best.listingType === "donation" ? "Donación" : "Ver anuncio"}
                                  </p>
                                </div>
                                <Button asChild size="sm"><Link href={"/marketplace/listing/" + best.id}>Ver opción</Link></Button>
                              </div>
                            ) : (
                              <div className="mt-3 rounded-xl bg-muted/30 p-3">
                                <p className="text-sm font-medium">Buscar por mí</p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                  En esta Beta 0 la necesidad queda guardada localmente. La siguiente fase conectará este estado con las alertas reales de Wetudy, sin cambiar el marketplace actual.
                                </p>
                                <Badge variant="secondary" className="mt-2">Pendiente</Badge>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                      Añade lo primero que necesitarás y comprobaremos si ya existe en Wetudy.
                    </div>
                  )}

                  <form action={(formData) => createNeed(learner.id, formData)} className="rounded-2xl bg-muted/30 p-4">
                    <div className="mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Añadir necesidad</p></div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <input name="title" placeholder="Ej. Matemáticas 2º ESO" maxLength={160} className="h-11 rounded-md border bg-background px-3 text-sm sm:col-span-2" />
                      <input name="isbn" placeholder="ISBN (opcional)" maxLength={40} className="h-11 rounded-md border bg-background px-3 text-sm" />
                      <select name="category" defaultValue="Libros de texto" className="h-11 rounded-md border bg-background px-3 text-sm sm:col-span-2">
                        <option>Libros de texto</option><option>Lectura y literatura</option><option>Material escolar</option><option>Uniformes</option><option>Tecnología y calculadoras</option><option>Mochilas y estuches</option><option>Música</option><option>Deporte escolar</option>
                      </select>
                      <Button type="submit"><BookOpen className="mr-2 h-4 w-4" />Buscar por mí</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-dashed">
            <CardContent className="space-y-4 p-5">
              <details>
                <summary className="cursor-pointer text-sm font-medium text-primary">+ Añadir otro hijo/a o curso</summary>
                <form action={createLearner} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input name="label" defaultValue={"Hijo/a " + (state.learners.length + 1)} maxLength={80} className="h-11 rounded-md border bg-background px-3 text-sm" />
                  <select name="schoolId" required className="h-11 rounded-md border bg-background px-3 text-sm"><option value="">Selecciona centro</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select>
                  <select name="gradeLevel" required className="h-11 rounded-md border bg-background px-3 text-sm"><option value="">Selecciona curso</option>{gradeLevels.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select>
                  <select name="academicYear" defaultValue="2026/27" className="h-11 rounded-md border bg-background px-3 text-sm"><option value="2026/27">2026/27</option><option value="2027/28">2027/28</option></select>
                  <Button type="submit" className="sm:col-span-2">Añadir curso</Button>
                </form>
              </details>
              <Button type="button" variant="ghost" size="sm" onClick={resetBeta} className="text-muted-foreground">Borrar mis datos de prueba</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
