"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  MapPin,
  PackageSearch,
  Plus,
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
  createdAt: string;
};

type StoredState = {
  needs: Need[];
};

type IncomingNeed = {
  title: string;
  isbn: string;
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

function safeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "need-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
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

export default function MyCourseClient({
  accountType,
  students,
  categories,
  listings,
  storageKey,
  incomingNeed,
}: {
  accountType: AccountType;
  students: CourseStudent[];
  categories: string[];
  listings: ListingSummary[];
  storageKey: string;
  incomingNeed: IncomingNeed | null;
}) {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState(students[0]?.id || "");
  const [title, setTitle] = useState(incomingNeed?.title || "");
  const [isbn, setIsbn] = useState(incomingNeed?.isbn || "");
  const [category, setCategory] = useState(categories[0] || "Libros de texto");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredState;
        if (Array.isArray(parsed?.needs)) {
          const validStudentIds = new Set(students.map((student) => student.id));
          setNeeds(
            parsed.needs.filter(
              (need) =>
                need &&
                typeof need.id === "string" &&
                typeof need.studentId === "string" &&
                validStudentIds.has(need.studentId)
            )
          );
        }
      }
    } catch {
      // Mi curso sigue siendo usable aunque el almacenamiento local falle.
    } finally {
      setHydrated(true);
    }
  }, [storageKey, students]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ needs } satisfies StoredState));
    } catch {
      // No bloqueamos la experiencia si el navegador no permite almacenamiento.
    }
  }, [hydrated, needs, storageKey]);

  useEffect(() => {
    if (students.some((student) => student.id === activeStudentId)) return;
    setActiveStudentId(students[0]?.id || "");
  }, [activeStudentId, students]);

  const activeStudent =
    students.find((student) => student.id === activeStudentId) || students[0] || null;

  const needsForStudent = useMemo(
    () => needs.filter((need) => need.studentId === activeStudent?.id),
    [activeStudent?.id, needs]
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

  function addNeed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeStudent) return;

    const cleanTitle = title.trim();
    const cleanIsbn = isbn.trim();

    if (!cleanTitle && !cleanIsbn) {
      setMessage("Añade un título o un ISBN.");
      return;
    }

    const duplicate = needs.some((need) => {
      if (need.studentId !== activeStudent.id) return false;
      const sameIsbn =
        cleanIsbn &&
        normalizeIsbn(need.isbn) === normalizeIsbn(cleanIsbn);
      const sameTitle =
        !cleanIsbn &&
        normalizeText(need.title) === normalizeText(cleanTitle);
      return Boolean(sameIsbn || sameTitle);
    });

    if (duplicate) {
      setMessage("Esta necesidad ya está en Mi curso.");
      return;
    }

    const need: Need = {
      id: safeId(),
      studentId: activeStudent.id,
      title: cleanTitle || cleanIsbn,
      isbn: cleanIsbn,
      category,
      createdAt: new Date().toISOString(),
    };

    setNeeds((current) => [need, ...current]);
    setTitle("");
    setIsbn("");
    setMessage("Necesidad añadida. Wetudy ha comprobado los anuncios disponibles.");
    window.history.replaceState({}, "", "/mi-curso");
  }

  function removeNeed(id: string) {
    setNeeds((current) => current.filter((need) => need.id !== id));
    setMessage("Necesidad eliminada.");
  }

  if (!hydrated || !activeStudent) {
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
                />
              </div>

              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
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

              <Button type="submit" className="w-full">
                <Search className="mr-2 h-4 w-4" />
                Añadir y buscar
              </Button>

              <p className="text-xs leading-5 text-muted-foreground">
                En esta primera versión, tus necesidades de Mi curso se guardan en este navegador.
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {needsForStudent.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center px-5 py-10 text-center">
                <BookOpen className="h-9 w-9 text-primary" />
                <p className="mt-3 font-semibold">Todavía no has añadido necesidades</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                  Añade libros, uniformes o material. Wetudy priorizará coincidencias de tu centro y curso.
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
                        onClick={() => removeNeed(need.id)}
                      >
                        <Trash2 className="h-4 w-4" />
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
                              La necesidad queda en Mi curso. Puedes volver a comprobarla cuando quieras.
                            </p>
                          </div>
                        </div>
                        <Button asChild variant="outline" size="sm" className="mt-3">
                          <Link href="/marketplace">Explorar Marketplace</Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
