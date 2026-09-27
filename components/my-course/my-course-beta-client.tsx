"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  MapPin,
  PackageSearch,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

type SchoolOption = { id: string; name: string; city: string | null };
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

type ProfileContext = {
  isLoggedIn: boolean;
  schoolId: string | null;
  schoolName: string | null;
  gradeLevel: string | null;
  academicYear: string;
};

const STORAGE_KEY = "wetudy_my_course_beta_v0";
const AUTO_PROFILE_SUPPRESS_KEY = "wetudy_my_course_beta_v0_suppress_profile";

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

function euro(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MyCourseBetaClient({
  schools,
  gradeLevels,
  listings,
  profileContext,
}: {
  schools: SchoolOption[];
  gradeLevels: string[];
  listings: ListingSummary[];
  profileContext: ProfileContext;
}) {
  const [state, setState] = useState<LocalState>({ learners: [], needs: [] });
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const suppressProfile = window.localStorage.getItem(AUTO_PROFILE_SUPPRESS_KEY) === "1";

      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.learners) && Array.isArray(parsed?.needs)) {
          if (parsed.learners.length > 0 || suppressProfile) {
            setState({ learners: parsed.learners, needs: parsed.needs });
            return;
          }
        }
      }

      if (
        !suppressProfile &&
        profileContext.isLoggedIn &&
        profileContext.schoolId &&
        profileContext.gradeLevel
      ) {
        setState({
          learners: [
            {
              id: "profile-course",
              label: "Mi curso",
              schoolId: profileContext.schoolId,
              gradeLevel: profileContext.gradeLevel,
              academicYear: profileContext.academicYear,
            },
          ],
          needs: [],
        });
      }
    } catch {
      // La beta debe seguir funcionando aunque el almacenamiento local falle.
    } finally {
      setHydrated(true);
    }
  }, [profileContext]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const schoolById = useMemo(
    () => new Map(schools.map((school) => [school.id, school])),
    [schools]
  );

  function matchesForNeed(need: Need, learner: Learner) {
    const wantedIsbn = normalizeIsbn(need.isbn);
    const wantedTitle = normalizeText(need.title);
    const wantedTokens = wantedTitle.split(/\s+/).filter((token) => token.length >= 3);

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
        if (listing.schoolId === learner.schoolId) score += 20;
        if (listing.gradeLevel === learner.gradeLevel) score += 10;
        if (listing.category === need.category) score += 3;

        return { listing, score };
      })
      .filter((candidate): candidate is { listing: ListingSummary; score: number } => Boolean(candidate))
      .sort((a, b) => b.score - a.score)
      .map((candidate) => candidate.listing);
  }

  function metricsForLearner(learner: Learner) {
    const learnerNeeds = state.needs.filter((need) => need.learnerId === learner.id);
    let matched = 0;
    let sameSchool = 0;
    let potentialSavings = 0;

    for (const need of learnerNeeds) {
      const best = matchesForNeed(need, learner)[0];
      if (!best) continue;
      matched += 1;
      if (best.schoolId === learner.schoolId) sameSchool += 1;
      if (best.price != null && best.originalPrice != null && best.originalPrice > best.price) {
        potentialSavings += best.originalPrice - best.price;
      }
    }

    return {
      total: learnerNeeds.length,
      matched,
      pending: learnerNeeds.length - matched,
      sameSchool,
      coverage: learnerNeeds.length ? Math.round((matched / learnerNeeds.length) * 100) : 0,
      potentialSavings,
    };
  }

  function createLearner(formData: FormData) {
    const schoolId = String(formData.get("schoolId") || "");
    window.localStorage.removeItem(AUTO_PROFILE_SUPPRESS_KEY);
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
    setMessage("Curso añadido. Ahora añade lo que necesitarás.");
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
    setMessage("Necesidad guardada. Wetudy ha comprobado los anuncios actuales.");
  }

  function removeNeed(id: string) {
    setState((current) => ({
      ...current,
      needs: current.needs.filter((need) => need.id !== id),
    }));
  }

  function resetBeta() {
    window.localStorage.setItem(AUTO_PROFILE_SUPPRESS_KEY, "1");
    setState({ learners: [], needs: [] });
    setConfirmingReset(false);
    setMessage("Datos locales de la beta eliminados.");
  }

  function restoreProfileCourse() {
    if (!profileContext.schoolId || !profileContext.gradeLevel) return;
    window.localStorage.removeItem(AUTO_PROFILE_SUPPRESS_KEY);
    setState({
      learners: [
        {
          id: "profile-course",
          label: "Mi curso",
          schoolId: profileContext.schoolId,
          gradeLevel: profileContext.gradeLevel,
          academicYear: profileContext.academicYear,
        },
      ],
      needs: [],
    });
    setMessage("Hemos recuperado el centro y curso de tu perfil.");
  }

  function loadDemo() {
    const firstListing = listings[0] || null;
    const preferredSchool =
      (firstListing?.schoolId && schoolById.get(firstListing.schoolId)) || schools[0] || null;

    if (!preferredSchool) {
      setMessage("Necesitamos al menos un centro para cargar el ejemplo.");
      return;
    }

    const relevantListings = listings
      .filter((listing) => !firstListing?.schoolId || listing.schoolId === firstListing.schoolId)
      .slice(0, 2);

    const learnerId = safeId("demo");
    const learner: Learner = {
      id: learnerId,
      label: "Ejemplo",
      schoolId: preferredSchool.id,
      gradeLevel: firstListing?.gradeLevel || gradeLevels[0] || "2º ESO",
      academicYear: "2026/27",
    };

    const demoNeeds: Need[] = [
      ...relevantListings.map((listing) => ({
        id: safeId("demo-need"),
        learnerId,
        title: listing.title,
        isbn: listing.isbn || "",
        category: listing.category || "Libros de texto",
        createdAt: new Date().toISOString(),
      })),
      {
        id: safeId("demo-pending"),
        learnerId,
        title: "Material pendiente de ejemplo",
        isbn: "",
        category: "Material escolar",
        createdAt: new Date().toISOString(),
      },
    ];

    setState({ learners: [learner], needs: demoNeeds });
    setMessage("Ejemplo cargado con anuncios reales disponibles y una necesidad pendiente.");
  }

  const globalMetrics = state.learners.reduce(
    (acc, learner) => {
      const metrics = metricsForLearner(learner);
      acc.total += metrics.total;
      acc.matched += metrics.matched;
      acc.pending += metrics.pending;
      acc.sameSchool += metrics.sameSchool;
      acc.potentialSavings += metrics.potentialSavings;
      return acc;
    },
    { total: 0, matched: 0, pending: 0, sameSchool: 0, potentialSavings: 0 }
  );

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">
        Preparando Mi curso…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/beta">← Otras opciones</Link>
        </Button>
      </div>

      <div className="mb-6 rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Beta 0 · solo Preview</Badge>
          <Badge variant="outline">Sin escrituras en producción</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">
          Prepara el curso sin buscarlo todo desde cero
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Dinos qué necesitarás. Wetudy comprueba lo que ya existe y te enseña cuánto de tu curso puedes resolver ahora mismo.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-background/80 p-3">
            <p className="text-xs font-semibold text-primary">1 · Tu curso</p>
            <p className="mt-1 text-xs text-muted-foreground">Centro, curso y año académico.</p>
          </div>
          <div className="rounded-2xl bg-background/80 p-3">
            <p className="text-xs font-semibold text-primary">2 · Lo que necesitas</p>
            <p className="mt-1 text-xs text-muted-foreground">Añade libros, uniforme o material.</p>
          </div>
          <div className="rounded-2xl bg-background/80 p-3">
            <p className="text-xs font-semibold text-primary">3 · Wetudy busca</p>
            <p className="mt-1 text-xs text-muted-foreground">Te enseña opciones y deja pendiente lo que falta.</p>
          </div>
        </div>
      </div>

      {message ? (
        <div className="mb-5 rounded-2xl border bg-muted/30 px-4 py-3 text-sm" role="status">
          {message}
        </div>
      ) : null}

      {state.learners.length > 0 ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Necesidades</p>
              <p className="mt-1 text-2xl font-bold">{globalMetrics.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Con opciones</p>
              <p className="mt-1 text-2xl font-bold">{globalMetrics.matched}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">En tu centro</p>
              <p className="mt-1 text-2xl font-bold">{globalMetrics.sameSchool}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Ahorro potencial</p>
              <p className="mt-1 text-2xl font-bold">
                {globalMetrics.potentialSavings > 0 ? euro(globalMetrics.potentialSavings) : "—"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Estimación cuando existe precio de referencia</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {state.learners.length === 0 ? (
        <div className="space-y-4">
          {profileContext.isLoggedIn && profileContext.schoolId && profileContext.gradeLevel ? (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Ya conocemos tu centro y curso</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {profileContext.schoolName} · {profileContext.gradeLevel}
                  </p>
                </div>
                <Button type="button" onClick={restoreProfileCourse}>Usar los datos de mi perfil</Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" /> Añade el primer curso
              </CardTitle>
              <CardDescription>
                {profileContext.isLoggedIn
                  ? "Solo tienes que rellenarlo si quieres añadir otro hijo/a o tu perfil no tiene centro y curso."
                  : "No necesitamos datos personales del menor. Basta una etiqueta, el centro y el curso."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createLearner} className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Etiqueta <span className="font-normal text-muted-foreground">(sin nombre real)</span></span>
                  <input
                    name="label"
                    defaultValue="Hijo/a 1"
                    maxLength={80}
                    autoComplete="off"
                    className="h-11 w-full rounded-md border bg-background px-3"
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Centro</span>
                  <select name="schoolId" required className="h-11 w-full rounded-md border bg-background px-3">
                    <option value="">Selecciona centro</option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                        {school.city ? " · " + school.city : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Curso</span>
                  <select name="gradeLevel" required className="h-11 w-full rounded-md border bg-background px-3">
                    <option value="">Selecciona curso</option>
                    {gradeLevels.map((grade) => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Año académico</span>
                  <select name="academicYear" defaultValue="2026/27" className="h-11 w-full rounded-md border bg-background px-3">
                    <option value="2026/27">2026/27</option>
                    <option value="2027/28">2027/28</option>
                  </select>
                </label>
                <Button type="submit" className="sm:col-span-2">
                  <Plus className="mr-2 h-4 w-4" /> Crear Mi curso
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">¿Quieres entender la idea antes de configurarla?</p>
                <p className="text-sm text-muted-foreground">
                  Carga un ejemplo local usando anuncios reales ya existentes. No modifica ningún dato.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={loadDemo}>
                Ver ejemplo
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {state.learners.map((learner) => {
            const learnerNeeds = state.needs.filter((need) => need.learnerId === learner.id);
            const metrics = metricsForLearner(learner);
            const school = schoolById.get(learner.schoolId);

            return (
              <Card key={learner.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{learner.label}</CardTitle>
                      <CardDescription>
                        {school?.name || "Centro"} · {learner.gradeLevel} · {learner.academicYear}
                      </CardDescription>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-2xl font-bold">{metrics.coverage}%</p>
                      <p className="text-xs text-muted-foreground">de la lista con opciones</p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: metrics.total ? metrics.coverage + "%" : "0%" }}
                    />
                  </div>
                  {metrics.total > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">{metrics.matched}/{metrics.total} encontradas</Badge>
                      <Badge variant="outline">{metrics.pending} pendientes</Badge>
                      {metrics.sameSchool > 0 ? (
                        <Badge variant="outline">
                          <MapPin className="mr-1 h-3 w-3" /> {metrics.sameSchool} en tu centro
                        </Badge>
                      ) : null}
                      {metrics.potentialSavings > 0 ? (
                        <Badge variant="outline">Ahorro potencial {euro(metrics.potentialSavings)}</Badge>
                      ) : null}
                    </div>
                  ) : null}
                </CardHeader>

                <CardContent className="space-y-5">
                  {learnerNeeds.length ? (
                    <div className="space-y-3">
                      {learnerNeeds.map((need) => {
                        const matches = matchesForNeed(need, learner);
                        const topMatches = matches.slice(0, 3);
                        const best = topMatches[0];

                        return (
                          <div key={need.id} className="rounded-2xl border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  {best ? (
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                  ) : (
                                    <Search className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <p className="font-medium">{need.title}</p>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {need.isbn ? "ISBN " + need.isbn + " · " : ""}
                                  {best
                                    ? matches.length + " opción/es encontradas"
                                    : "Todavía no aparece en los anuncios actuales"}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeNeed(need.id)}
                                aria-label="Eliminar necesidad"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {best ? (
                              <div className="mt-3 space-y-2">
                                {topMatches.map((match, index) => {
                                  const sameSchool = match.schoolId === learner.schoolId;
                                  const savings =
                                    match.price != null &&
                                    match.originalPrice != null &&
                                    match.originalPrice > match.price
                                      ? match.originalPrice - match.price
                                      : 0;

                                  return (
                                    <div
                                      key={match.id}
                                      className="flex flex-col gap-2 rounded-xl bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <p className="truncate text-sm font-medium">{match.title}</p>
                                          {index === 0 ? <Badge variant="secondary">Mejor opción</Badge> : null}
                                          {sameSchool ? <Badge variant="outline">Tu centro</Badge> : null}
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          {match.listingType === "donation"
                                            ? "Donación"
                                            : match.price != null
                                              ? euro(match.price)
                                              : "Consultar"}
                                          {savings > 0 ? " · Ahorras aprox. " + euro(savings) : ""}
                                        </p>
                                      </div>
                                      <Button asChild size="sm" variant={index === 0 ? "default" : "outline"}>
                                        <Link href={"/marketplace/listing/" + match.id}>Ver y contactar</Link>
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="mt-3 rounded-xl bg-muted/30 p-3">
                                <div className="flex items-start gap-2">
                                  <PackageSearch className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-sm font-medium">Wetudy debería buscarlo por ti</p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                      En esta Beta 0 lo dejamos marcado como pendiente. La siguiente fase convertirá este estado en demanda real y activará alertas y posibles vendedores.
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Badge variant="secondary">Pendiente</Badge>
                                  <Button asChild size="sm" variant="outline">
                                    <Link href="/marketplace">Buscar manualmente</Link>
                                  </Button>
                                </div>
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

                  <form
                    action={(formData) => createNeed(learner.id, formData)}
                    className="rounded-2xl bg-muted/30 p-4"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">Añadir necesidad</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <input
                        name="title"
                        placeholder="Ej. Matemáticas 2º ESO"
                        maxLength={160}
                        className="h-11 rounded-md border bg-background px-3 text-sm sm:col-span-2"
                      />
                      <input
                        name="isbn"
                        placeholder="ISBN (opcional)"
                        maxLength={40}
                        className="h-11 rounded-md border bg-background px-3 text-sm"
                      />
                      <select
                        name="category"
                        defaultValue="Libros de texto"
                        className="h-11 rounded-md border bg-background px-3 text-sm sm:col-span-2"
                      >
                        <option>Libros de texto</option>
                        <option>Lectura y literatura</option>
                        <option>Material escolar</option>
                        <option>Uniformes</option>
                        <option>Tecnología y calculadoras</option>
                        <option>Mochilas y estuches</option>
                        <option>Música</option>
                        <option>Deporte escolar</option>
                      </select>
                      <Button type="submit">
                        <BookOpen className="mr-2 h-4 w-4" /> Buscar por mí
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-dashed">
            <CardContent className="space-y-4 p-5">
              {profileContext.isLoggedIn ? (
                <p className="text-xs text-muted-foreground">
                  Tu curso principal parte de los datos de Mi cuenta. Añade otro solo si necesitas gestionar más de un hijo/a o centro.
                </p>
              ) : null}
              <details>
                <summary className="cursor-pointer text-sm font-medium text-primary">
                  + Añadir otro hijo/a o curso
                </summary>
                <form action={createLearner} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input
                    name="label"
                    defaultValue={"Hijo/a " + (state.learners.length + 1)}
                    maxLength={80}
                    className="h-11 rounded-md border bg-background px-3 text-sm"
                  />
                  <select name="schoolId" required className="h-11 rounded-md border bg-background px-3 text-sm">
                    <option value="">Selecciona centro</option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>{school.name}</option>
                    ))}
                  </select>
                  <select name="gradeLevel" required className="h-11 rounded-md border bg-background px-3 text-sm">
                    <option value="">Selecciona curso</option>
                    {gradeLevels.map((grade) => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                  <select name="academicYear" defaultValue="2026/27" className="h-11 rounded-md border bg-background px-3 text-sm">
                    <option value="2026/27">2026/27</option>
                    <option value="2027/28">2027/28</option>
                  </select>
                  <Button type="submit" className="sm:col-span-2">Añadir curso</Button>
                </form>
              </details>
              {!confirmingReset ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingReset(true)}
                  className="text-muted-foreground"
                >
                  Borrar mis datos de prueba
                </Button>
              ) : (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-sm font-medium">¿Borrar los datos guardados en este navegador?</p>
                  <p className="mt-1 text-xs text-muted-foreground">No afecta a tu cuenta ni a los anuncios de Wetudy.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="destructive" onClick={resetBeta}>
                      Sí, borrar
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setConfirmingReset(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
