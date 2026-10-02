"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellOff,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Loader2,
  MapPin,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AccountType = "student" | "parent";

type CourseStudent = {
  id: string;
  label: string;
  schoolId: string | null;
  schoolName: string | null;
  schoolCity: string | null;
  gradeLevel: string;
  academicYear: string;
  isPrimary: boolean;
};

type ListingSummary = {
  id: string;
  title: string;
  category: string | null;
  gradeLevel: string | null;
  isbn: string | null;
  schoolId: string | null;
  price: number | null;
  originalPrice: number | null;
  listingType: string | null;
};

type Need = {
  id: string;
  studentId: string;
  title: string;
  isbn: string;
  category: string;
  academicYear: string;
  demandRequestId: string | null;
  searchActive: boolean;
  createdAt: string;
};

type FulfilledNeed = {
  id: string;
  studentId: string;
  title: string;
  isbn: string;
  category: string;
  academicYear: string;
  fulfilledAt: string;
  listingId: string | null;
  listingTitle: string | null;
  listingStatus: string | null;
  agreementId: string | null;
  agreementType: string | null;
  agreementAmount: number | null;
  agreementConfirmedAt: string | null;
  conversationId: string | null;
};

type IncomingNeed = {
  title: string;
  isbn: string;
};

type LegacyNeed = {
  id?: string;
  studentId?: string;
  title?: string;
  isbn?: string;
  category?: string;
  createdAt?: string;
};

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

function euro(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function listingPriceLabel(listing: ListingSummary) {
  if (listing.listingType === "donation") return "Donación";
  if (listing.price == null) return "Consultar";
  return euro(listing.price);
}

function sameNeedIdentity(active: Need, fulfilled: FulfilledNeed) {
  if (active.studentId !== fulfilled.studentId) return false;

  const fulfilledIsbn = normalizeIsbn(fulfilled.isbn);
  const activeIsbn = normalizeIsbn(active.isbn);
  if (fulfilledIsbn) return activeIsbn === fulfilledIsbn;

  return (
    !activeIsbn &&
    normalizeText(active.title) === normalizeText(fulfilled.title) &&
    normalizeText(active.category) === normalizeText(fulfilled.category)
  );
}

function fromApiNeed(raw: any): Need | null {
  if (!raw?.id || !raw?.student_id || !raw?.title || !raw?.academic_year) {
    return null;
  }

  return {
    id: String(raw.id),
    studentId: String(raw.student_id),
    title: String(raw.title),
    isbn: typeof raw.isbn === "string" ? raw.isbn : "",
    category: typeof raw.category === "string" ? raw.category : "Libros de texto",
    academicYear: String(raw.academic_year),
    demandRequestId: typeof raw.demand_request_id === "string" ? raw.demand_request_id : null,
    searchActive: raw.search_active === true,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
  };
}

export default function MyCourseClient({
  accountType,
  students,
  categories,
  listings,
  initialNeeds,
  fulfilledNeeds,
  legacyStorageKey,
  incomingNeed,
}: {
  accountType: AccountType;
  students: CourseStudent[];
  categories: string[];
  listings: ListingSummary[];
  initialNeeds: Need[];
  fulfilledNeeds: FulfilledNeed[];
  legacyStorageKey: string;
  incomingNeed: IncomingNeed | null;
}) {
  const [needs, setNeeds] = useState<Need[]>(initialNeeds);
  const [activeStudentId, setActiveStudentId] = useState(students[0]?.id || "");
  const [title, setTitle] = useState(incomingNeed?.title || "");
  const [isbn, setIsbn] = useState(incomingNeed?.isbn || "");
  const [category, setCategory] = useState(categories[0] || "Libros de texto");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [restartingId, setRestartingId] = useState<string | null>(null);
  const legacyImportStarted = useRef(false);

  useEffect(() => {
    if (students.some((student) => student.id === activeStudentId)) return;
    setActiveStudentId(students[0]?.id || "");
  }, [activeStudentId, students]);

  useEffect(() => {
    if (legacyImportStarted.current) return;
    legacyImportStarted.current = true;

    let cancelled = false;

    async function importLegacyNeeds() {
      try {
        const raw = window.localStorage.getItem(legacyStorageKey);
        if (!raw) return;

        const parsed = JSON.parse(raw) as { needs?: LegacyNeed[] };
        const legacyNeeds = Array.isArray(parsed?.needs) ? parsed.needs : [];

        if (legacyNeeds.length === 0) {
          window.localStorage.removeItem(legacyStorageKey);
          return;
        }

        const validStudentIds = new Set(students.map((student) => student.id));
        const importable = legacyNeeds.filter(
          (need) =>
            typeof need?.studentId === "string" &&
            validStudentIds.has(need.studentId) &&
            (Boolean(need.title?.trim()) || Boolean(need.isbn?.trim()))
        );

        if (importable.length === 0) {
          window.localStorage.removeItem(legacyStorageKey);
          return;
        }

        const imported: Need[] = [];
        let allHandled = true;

        for (const legacy of importable) {
          const response = await fetch("/api/my-course/needs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId: legacy.studentId,
              title: legacy.title || legacy.isbn || "",
              isbn: legacy.isbn || "",
              category: legacy.category || "Libros de texto",
            }),
          });

          const payload = await response.json().catch(() => null);

          if (response.ok) {
            const mapped = fromApiNeed(payload?.need);
            if (mapped) imported.push(mapped);
            continue;
          }

          if (response.status === 409 && payload?.code === "need_exists") {
            continue;
          }

          allHandled = false;
          break;
        }

        if (cancelled) return;

        if (imported.length > 0) {
          setNeeds((current) => {
            const existingIds = new Set(current.map((need) => need.id));
            return [
              ...imported.filter((need) => !existingIds.has(need.id)),
              ...current,
            ];
          });
        }

        if (allHandled) {
          window.localStorage.removeItem(legacyStorageKey);
          setMessage(
            imported.length > 0
              ? "Hemos guardado en tu cuenta las necesidades que tenías en este navegador."
              : ""
          );
        }
      } catch {
        // Si la importación falla, conservamos el almacenamiento local para reintentar.
      }
    }

    void importLegacyNeeds();

    return () => {
      cancelled = true;
    };
  }, [legacyStorageKey, students]);

  const activeStudent =
    students.find((student) => student.id === activeStudentId) || students[0] || null;

  const needsForStudent = useMemo(
    () =>
      needs.filter(
        (need) =>
          need.studentId === activeStudent?.id &&
          need.academicYear === activeStudent?.academicYear
      ),
    [activeStudent?.academicYear, activeStudent?.id, needs]
  );

  const fulfilledForStudent = useMemo(
    () =>
      fulfilledNeeds.filter(
        (need) => need.studentId === activeStudent?.id
      ),
    [activeStudent?.id, fulfilledNeeds]
  );

  function matchesForNeed(need: Need, student: CourseStudent) {
    const wantedIsbn = normalizeIsbn(need.isbn);
    const wantedTitle = normalizeText(need.title);
    const wantedTokens = wantedTitle
      .split(/\s+/)
      .filter((token) => token.length >= 3);

    return listings
      .map((listing) => {
        const listingTitle = normalizeText(listing.title);
        const listingIsbn = normalizeIsbn(listing.isbn);
        const isbnMatch = Boolean(wantedIsbn && listingIsbn === wantedIsbn);
        const exactTitleMatch = Boolean(wantedTitle && listingTitle.includes(wantedTitle));
        const tokenHits = wantedTokens.filter((token) => listingTitle.includes(token)).length;
        const tokenRatio = wantedTokens.length ? tokenHits / wantedTokens.length : 0;
        const textMatch = exactTitleMatch || tokenRatio >= 0.6;

        if (!isbnMatch && !textMatch) return null;

        let score = isbnMatch ? 100 : Math.round(tokenRatio * 20);
        if (student.schoolId && listing.schoolId === student.schoolId) score += 20;
        if (listing.gradeLevel === student.gradeLevel) score += 10;
        if (listing.category === need.category) score += 3;

        return { listing, score };
      })
      .filter(
        (candidate): candidate is { listing: ListingSummary; score: number } =>
          Boolean(candidate)
      )
      .sort((a, b) => b.score - a.score)
      .map((candidate) => candidate.listing);
  }

  const metrics = useMemo(() => {
    if (!activeStudent) {
      return {
        total: 0,
        covered: 0,
        pending: 0,
        options: 0,
        sameSchool: 0,
        potentialSavings: 0,
      };
    }

    let covered = 0;
    let options = 0;
    let sameSchool = 0;
    let potentialSavings = 0;

    for (const need of needsForStudent) {
      const matches = matchesForNeed(need, activeStudent).slice(0, 3);
      if (matches.length === 0) continue;

      covered += 1;
      options += matches.length;
      sameSchool += matches.filter(
        (listing) => activeStudent.schoolId && listing.schoolId === activeStudent.schoolId
      ).length;

      const best = matches[0];
      if (
        best.price != null &&
        best.originalPrice != null &&
        best.originalPrice > best.price
      ) {
        potentialSavings += best.originalPrice - best.price;
      }
    }

    return {
      total: needsForStudent.length,
      covered,
      pending: needsForStudent.length - covered,
      options,
      sameSchool,
      potentialSavings,
    };
  }, [activeStudent, needsForStudent, listings]);

  async function addNeed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeStudent || saving) return;

    const cleanTitle = title.trim();
    const cleanIsbn = isbn.trim();

    if (!cleanTitle && !cleanIsbn) {
      setMessage("Añade un título o un ISBN.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/my-course/needs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: activeStudent.id,
          title: cleanTitle || cleanIsbn,
          isbn: cleanIsbn,
          category,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo guardar la necesidad.");
      }

      const need = fromApiNeed(payload?.need);
      if (!need) {
        throw new Error("No se pudo leer la necesidad guardada.");
      }

      setNeeds((current) => [need, ...current]);
      setTitle("");
      setIsbn("");
      setMessage("Necesidad guardada. Wetudy ha comprobado los anuncios disponibles.");
      window.history.replaceState({}, "", "/mi-curso");
    } catch (cause: any) {
      setMessage(cause?.message || "No se pudo guardar la necesidad.");
    } finally {
      setSaving(false);
    }
  }

  async function activateSearch(need: Need) {
    if (searchingId || need.searchActive) return;

    setSearchingId(need.id);
    setMessage("");

    try {
      const response = await fetch("/api/my-course/needs/" + need.id + "/search", {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo activar Buscar por mí.");
      }

      const updated = fromApiNeed(payload?.need);
      if (!updated) {
        throw new Error("No se pudo leer la búsqueda activada.");
      }

      setNeeds((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setMessage("Buscar por mí está activo. Te avisaremos cuando aparezca una coincidencia.");
    } catch (cause: any) {
      setMessage(cause?.message || "No se pudo activar Buscar por mí.");
    } finally {
      setSearchingId(null);
    }
  }

  async function pauseSearch(need: Need) {
    if (searchingId || !need.demandRequestId || !need.searchActive) return;

    setSearchingId(need.id);
    setMessage("");

    try {
      const response = await fetch("/api/my-course/needs/" + need.id + "/search", {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo pausar Buscar por mí.");
      }

      const updated = fromApiNeed(payload?.need);
      if (!updated) {
        throw new Error("No se pudo leer la búsqueda pausada.");
      }

      setNeeds((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setMessage("Buscar por mí está pausado. Puedes reactivarlo cuando quieras.");
    } catch (cause: any) {
      setMessage(cause?.message || "No se pudo pausar Buscar por mí.");
    } finally {
      setSearchingId(null);
    }
  }

  async function restartFulfilledNeed(need: FulfilledNeed) {
    if (restartingId) return;

    setRestartingId(need.id);
    setMessage("");

    try {
      const response = await fetch(
        "/api/my-course/needs/" + need.id + "/restart",
        { method: "POST" }
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo volver a buscar este material.");
      }

      const restarted = fromApiNeed(payload?.need);
      if (!restarted) {
        throw new Error("No se pudo leer la nueva búsqueda.");
      }

      setNeeds((current) => [
        restarted,
        ...current.filter((item) => item.id !== restarted.id),
      ]);
      setMessage(
        payload?.reused_existing
          ? "Ya había una búsqueda activa para este material. La hemos reactivado."
          : "Nueva búsqueda activada. Conservamos el acuerdo anterior en Conseguidos."
      );
    } catch (cause: any) {
      setMessage(cause?.message || "No se pudo volver a buscar este material.");
    } finally {
      setRestartingId(null);
    }
  }

  async function removeNeed(id: string) {
    if (deletingId) return;

    setDeletingId(id);
    setMessage("");

    try {
      const response = await fetch("/api/my-course/needs/" + id, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo eliminar la necesidad.");
      }

      setNeeds((current) => current.filter((need) => need.id !== id));
      setMessage("Necesidad eliminada de Mi curso.");
    } catch (cause: any) {
      setMessage(cause?.message || "No se pudo eliminar la necesidad.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!activeStudent) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 text-sm text-muted-foreground">
        Preparando Mi curso…
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <section className="rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge variant="secondary">Tu curso, organizado</Badge>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Mi curso
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Añade lo que necesitas y Wetudy comprueba qué opciones hay disponibles ahora mismo.
            </p>
          </div>

          <Button asChild variant="outline">
            <Link href="/account">
              <GraduationCap className="mr-2 h-4 w-4" />
              Gestionar estudiantes
            </Link>
          </Button>
        </div>

        {accountType === "parent" && students.length > 1 ? (
          <div className="mt-5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estudiante
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {students.map((student) => (
                <Button
                  key={student.id}
                  type="button"
                  size="sm"
                  variant={student.id === activeStudent.id ? "default" : "outline"}
                  onClick={() => {
                    setActiveStudentId(student.id);
                    setMessage("");
                  }}
                >
                  {student.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{activeStudent.label}</Badge>
          <Badge variant="outline">{activeStudent.gradeLevel}</Badge>
          <Badge variant="outline">{activeStudent.academicYear}</Badge>
          {activeStudent.schoolName ? (
            <Badge variant="outline" className="gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {activeStudent.schoolName}
            </Badge>
          ) : (
            <Badge variant="outline">Sin centro</Badge>
          )}
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="gap-0 py-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Necesidades</p>
            <p className="mt-1 text-2xl font-bold">{metrics.total}</p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Con opciones</p>
            <p className="mt-1 text-2xl font-bold">{metrics.covered}</p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendientes</p>
            <p className="mt-1 text-2xl font-bold">{metrics.pending}</p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Opciones visibles</p>
            <p className="mt-1 text-2xl font-bold">{metrics.options}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 gap-0 py-0 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ahorro potencial</p>
            <p className="mt-1 text-2xl font-bold">
              {metrics.potentialSavings > 0 ? euro(metrics.potentialSavings) : "—"}
            </p>
          </CardContent>
        </Card>
      </section>

      {message ? (
        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <section className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-primary" />
              Añadir necesidad
            </CardTitle>
            <CardDescription>
              Puedes empezar por el título o usar el ISBN si lo tienes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={addNeed}>
              <div className="space-y-2">
                <Label htmlFor="course-need-title">Título o material</Label>
                <Input
                  id="course-need-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value.slice(0, 180))}
                  placeholder="Ej. Matemáticas 2º ESO"
                  className="text-base sm:text-sm"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="course-need-isbn">ISBN <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Input
                  id="course-need-isbn"
                  value={isbn}
                  onChange={(event) => setIsbn(event.target.value.slice(0, 32))}
                  placeholder="978..."
                  inputMode="numeric"
                  className="text-base sm:text-sm"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={category} onValueChange={setCategory} disabled={saving}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {saving ? "Guardando…" : "Añadir y buscar"}
              </Button>

              <p className="text-xs leading-5 text-muted-foreground">
                Tus necesidades se guardan en tu cuenta y quedan asociadas al estudiante seleccionado.
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {needsForStudent.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center px-5 py-10 text-center">
                <BookOpen className="h-9 w-9 text-primary" />
                <p className="mt-3 font-semibold">
                  {fulfilledForStudent.length > 0
                    ? "No tienes necesidades pendientes"
                    : "Todavía no has añadido necesidades"}
                </p>
                <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                  {fulfilledForStudent.length > 0
                    ? "Lo que ya conseguiste aparece en tu historial más abajo."
                    : "Añade libros, uniformes o material. Wetudy priorizará coincidencias de tu centro y curso."}
                </p>
              </CardContent>
            </Card>
          ) : (
            needsForStudent.map((need) => {
              const matches = matchesForNeed(need, activeStudent).slice(0, 3);

              return (
                <Card key={need.id}>
                  <CardHeader className="pb-3">
                    <div className="flex gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base">{need.title}</CardTitle>
                          {matches.length > 0 ? (
                            <Badge className="gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {matches.length} {matches.length === 1 ? "opción" : "opciones"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pendiente</Badge>
                          )}
                        </div>
                        <CardDescription className="mt-1">
                          {need.category}
                          {need.isbn ? " · ISBN " + need.isbn : ""}
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar necesidad"
                        onClick={() => void removeNeed(need.id)}
                        disabled={deletingId === need.id}
                      >
                        {deletingId === need.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {matches.length > 0 ? (
                      <div className="space-y-2">
                        {matches.map((listing) => (
                          <Link
                            key={listing.id}
                            href={`/marketplace/listing/${listing.id}`}
                            className="flex items-center justify-between gap-3 rounded-xl border p-3 transition hover:bg-muted/40"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{listing.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {listing.gradeLevel || "Varios cursos"}
                                {activeStudent.schoolId && listing.schoolId === activeStudent.schoolId
                                  ? " · Tu centro"
                                  : ""}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-primary">
                              {listingPriceLabel(listing)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-muted/40 p-4">
                        <div className="flex items-start gap-3">
                          <PackageSearch className="mt-0.5 h-5 w-5 text-primary" />
                          <div>
                            <p className="text-sm font-semibold">Sin coincidencias ahora</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {need.searchActive
                                ? "Buscar por mí está activo. Wetudy te avisará cuando aparezca una coincidencia."
                                : need.demandRequestId
                                  ? "Buscar por mí está pausado. La necesidad sigue guardada y puedes reactivar el aviso sin crear otra búsqueda."
                                  : "La necesidad queda guardada en tu cuenta. Puedes activar Buscar por mí para recibir avisos cuando aparezca una coincidencia."}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {need.searchActive ? (
                            <>
                              <Button type="button" variant="secondary" size="sm" disabled>
                                <Search className="mr-2 h-4 w-4" />
                                Buscando por ti
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void pauseSearch(need)}
                                disabled={searchingId === need.id}
                              >
                                {searchingId === need.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <BellOff className="mr-2 h-4 w-4" />
                                )}
                                {searchingId === need.id ? "Pausando…" : "Pausar aviso"}
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void activateSearch(need)}
                              disabled={searchingId === need.id}
                            >
                              {searchingId === need.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Search className="mr-2 h-4 w-4" />
                              )}
                              {searchingId === need.id
                                ? "Activando…"
                                : need.demandRequestId
                                  ? "Reactivar búsqueda"
                                  : "Buscar por mí"}
                            </Button>
                          )}
                          <Button asChild variant="outline" size="sm">
                            <Link href="/marketplace">Explorar Marketplace</Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {fulfilledForStudent.length > 0 ? (
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary">Historial</p>
              <h2 className="mt-1 text-xl font-semibold">Conseguidos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Materiales que ya resolviste mediante un acuerdo confirmado en Wetudy.
              </p>
            </div>
            <Badge variant="secondary">
              {fulfilledForStudent.length}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {fulfilledForStudent.map((need) => {
              const activeRestart = needs.some((item) =>
                sameNeedIdentity(item, need)
              );
              const resolvedDate = new Date(need.fulfilledAt);
              const resolvedLabel = Number.isNaN(resolvedDate.getTime())
                ? null
                : resolvedDate.toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
              const agreementLabel =
                need.agreementType === "donation"
                  ? "Donación"
                  : need.agreementAmount != null
                    ? euro(need.agreementAmount)
                    : "Acuerdo confirmado";

              return (
                <Card key={need.id} className="border-primary/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base">{need.title}</CardTitle>
                          <Badge variant="secondary">Conseguido</Badge>
                        </div>
                        <CardDescription className="mt-1">
                          {need.category}
                          {need.isbn ? " · ISBN " + need.isbn : ""}
                          {need.academicYear ? " · " + need.academicYear : ""}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl bg-muted/40 p-4">
                      <p className="text-sm font-semibold">
                        {need.listingTitle || "Necesidad resuelta"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {agreementLabel}
                        {resolvedLabel ? " · Conseguido el " + resolvedLabel : ""}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeRestart ? (
                        <Button type="button" variant="secondary" size="sm" disabled>
                          <Search className="mr-2 h-4 w-4" />
                          Buscando de nuevo
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void restartFulfilledNeed(need)}
                          disabled={restartingId === need.id}
                        >
                          {restartingId === need.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          {restartingId === need.id ? "Activando…" : "Volver a buscar"}
                        </Button>
                      )}
                      {(need.listingId || need.conversationId) ? (
                        {need.listingId ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/marketplace/listing/${need.listingId}`}>
                              Ver anuncio
                            </Link>
                          </Button>
                        ) : null}
                        {need.conversationId ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/messages/${need.conversationId}`}>
                              Ver conversación
                            </Link>
                          </Button>
                        ) : null}
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
