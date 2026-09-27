"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, CheckCircle2, GraduationCap, Plus, Search, Sparkles } from "lucide-react";

type SchoolOption = {
  id: string;
  name: string;
  city: string | null;
};

type Learner = {
  id: string;
  label: string;
  school_id: string;
  grade_level: string;
  academic_year: string;
};

type Need = {
  id: string;
  learner_id: string;
  title: string;
  category: string | null;
  isbn: string | null;
  status: string;
  matched_listing_id: string | null;
};

type ListingSummary = {
  id: string;
  title: string;
  price: number | null;
  listing_type: string | null;
  type: string | null;
};

export default function MyCourseBetaClient({
  schools,
  gradeLevels,
  learners,
  needs,
  listings,
}: {
  schools: SchoolOption[];
  gradeLevels: string[];
  learners: Learner[];
  needs: Need[];
  listings: ListingSummary[];
}) {
  const router = useRouter();
  const [learnerBusy, setLearnerBusy] = useState(false);
  const [needBusyFor, setNeedBusyFor] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const listingById = useMemo(
    () => new Map(listings.map((listing) => [listing.id, listing])),
    [listings]
  );

  async function createLearner(formData: FormData) {
    setLearnerBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/beta/my-course/learners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: formData.get("label"),
          schoolId: formData.get("schoolId"),
          gradeLevel: formData.get("gradeLevel"),
          academicYear: formData.get("academicYear"),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "No se pudo añadir el curso.");

      setMessage("Curso añadido.");
      router.refresh();
    } catch (error: any) {
      setMessage(error?.message || "No se pudo añadir el curso.");
    } finally {
      setLearnerBusy(false);
    }
  }

  async function createNeed(learnerId: string, formData: FormData) {
    setNeedBusyFor(learnerId);
    setMessage("");

    try {
      const response = await fetch("/api/beta/my-course/needs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerId,
          title: formData.get("title"),
          isbn: formData.get("isbn"),
          category: formData.get("category"),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "No se pudo guardar la necesidad.");

      setMessage(payload?.matchListingId ? "Encontramos una opción disponible." : "Wetudy lo buscará por ti.");
      router.refresh();
    } catch (error: any) {
      setMessage(error?.message || "No se pudo guardar la necesidad.");
    } finally {
      setNeedBusyFor(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <div className="mb-6 rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Beta privada</Badge>
          <Badge variant="outline">Mi curso</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">Prepara el curso sin buscarlo todo desde cero</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Guarda lo que necesitará cada hijo/a. Wetudy comprueba el marketplace actual y, si todavía no existe, mantiene la necesidad activa para avisarte cuando aparezca.
        </p>
      </div>

      {message ? (
        <div className="mb-5 rounded-2xl border bg-muted/30 px-4 py-3 text-sm" role="status">
          {message}
        </div>
      ) : null}

      {learners.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Añade el primer curso</CardTitle>
            <CardDescription>No pedimos datos personales del menor. Una etiqueta, centro y curso son suficientes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createLearner} className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Etiqueta</span>
                <input name="label" defaultValue="Hijo/a 1" maxLength={80} className="h-11 w-full rounded-md border bg-background px-3" />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Centro</span>
                <select name="schoolId" required className="h-11 w-full rounded-md border bg-background px-3">
                  <option value="">Selecciona centro</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}{school.city ? " · " + school.city : ""}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Curso</span>
                <select name="gradeLevel" required className="h-11 w-full rounded-md border bg-background px-3">
                  <option value="">Selecciona curso</option>
                  {gradeLevels.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Año académico</span>
                <select name="academicYear" defaultValue="2026/27" className="h-11 w-full rounded-md border bg-background px-3">
                  <option value="2026/27">2026/27</option>
                  <option value="2027/28">2027/28</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={learnerBusy}>
                  <Plus className="mr-2 h-4 w-4" />
                  {learnerBusy ? "Añadiendo..." : "Crear Mi curso"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {learners.map((learner) => {
            const learnerNeeds = needs.filter((need) => need.learner_id === learner.id);
            const matchedCount = learnerNeeds.filter((need) => need.matched_listing_id).length;

            return (
              <Card key={learner.id}>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{learner.label}</CardTitle>
                      <CardDescription>{learner.grade_level} · {learner.academic_year}</CardDescription>
                    </div>
                    <Badge variant="outline">
                      {matchedCount}/{learnerNeeds.length} encontradas
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {learnerNeeds.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                      Añade la primera necesidad para comprobar si ya existe en Wetudy.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {learnerNeeds.map((need) => {
                        const listing = need.matched_listing_id ? listingById.get(need.matched_listing_id) : null;

                        return (
                          <div key={need.id} className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {listing ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Search className="h-4 w-4 text-muted-foreground" />}
                                <p className="font-medium">{need.title}</p>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {need.isbn ? "ISBN " + need.isbn + " · " : ""}
                                {listing ? "Hay una opción disponible" : "Buscando por ti"}
                              </p>
                            </div>
                            {listing ? (
                              <Button asChild size="sm">
                                <Link href={"/marketplace/listing/" + listing.id}>Ver opción</Link>
                              </Button>
                            ) : (
                              <Badge variant="secondary">Aviso activo</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <form action={(formData) => createNeed(learner.id, formData)} className="rounded-2xl bg-muted/30 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">Añadir necesidad</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <input name="title" placeholder="Ej. Matemáticas 2º ESO" maxLength={160} className="h-11 rounded-md border bg-background px-3 text-sm sm:col-span-2" />
                      <input name="isbn" placeholder="ISBN (opcional)" maxLength={40} className="h-11 rounded-md border bg-background px-3 text-sm" />
                      <select name="category" defaultValue="Libros de texto" className="h-11 rounded-md border bg-background px-3 text-sm sm:col-span-2">
                        <option>Libros de texto</option>
                        <option>Lectura y literatura</option>
                        <option>Material escolar</option>
                        <option>Uniformes</option>
                        <option>Tecnología y calculadoras</option>
                        <option>Mochilas y estuches</option>
                        <option>Música</option>
                        <option>Deporte escolar</option>
                      </select>
                      <Button type="submit" disabled={needBusyFor === learner.id}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        {needBusyFor === learner.id ? "Guardando..." : "Buscar por mí"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-dashed">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">¿Otro hijo/a o curso?</p>
                <p className="text-sm text-muted-foreground">La beta ya admite varios contextos sin cambiar tu perfil principal.</p>
              </div>
              <details>
                <summary className="cursor-pointer text-sm font-medium text-primary">Añadir otro</summary>
                <form action={createLearner} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input name="label" defaultValue={"Hijo/a " + (learners.length + 1)} maxLength={80} className="h-11 rounded-md border bg-background px-3 text-sm" />
                  <select name="schoolId" required className="h-11 rounded-md border bg-background px-3 text-sm">
                    <option value="">Selecciona centro</option>
                    {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                  </select>
                  <select name="gradeLevel" required className="h-11 rounded-md border bg-background px-3 text-sm">
                    <option value="">Selecciona curso</option>
                    {gradeLevels.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                  </select>
                  <select name="academicYear" defaultValue="2026/27" className="h-11 rounded-md border bg-background px-3 text-sm">
                    <option value="2026/27">2026/27</option>
                    <option value="2027/28">2027/28</option>
                  </select>
                  <Button type="submit" disabled={learnerBusy} className="sm:col-span-2">Añadir curso</Button>
                </form>
              </details>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
