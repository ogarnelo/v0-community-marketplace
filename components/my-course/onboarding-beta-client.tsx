"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, MapPin, Plus, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SchoolOption = {
  id: string;
  name: string;
  city: string | null;
};

type AccountType = "student" | "parent";

type DraftStudent = {
  id: string;
  alias: string;
  schoolId: string;
  gradeLevel: string;
  academicYear: string;
};

const ONBOARDING_STORAGE_KEY = "wetudy_onboarding_beta_v1";
const COURSE_STORAGE_KEY = "wetudy_my_course_beta_v0";
const SUPPRESS_PROFILE_KEY = "wetudy_my_course_beta_v0_suppress_profile";

function safeId(prefix: string) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function currentAcademicYear() {
  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return startYear + "/" + String((startYear + 1) % 100).padStart(2, "0");
}

function validSpanishPostalCode(value: string) {
  if (!/^\d{5}$/.test(value)) return false;
  const prefix = Number(value.slice(0, 2));
  return Number.isInteger(prefix) && prefix >= 1 && prefix <= 52;
}

export default function OnboardingBetaClient({
  schools,
  gradeLevels,
}: {
  schools: SchoolOption[];
  gradeLevels: string[];
}) {
  const router = useRouter();
  const academicYear = useMemo(() => currentAcademicYear(), []);
  const [step, setStep] = useState<1 | 2>(1);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [postalCode, setPostalCode] = useState("");
  const [students, setStudents] = useState<DraftStudent[]>([]);
  const [alias, setAlias] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [error, setError] = useState("");

  function continueAccount() {
    if (!accountType) {
      setError("Elige si usarás Wetudy como estudiante o como familia / tutor.");
      return;
    }
    if (!validSpanishPostalCode(postalCode.trim())) {
      setError("Introduce un código postal español válido.");
      return;
    }
    setError("");
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setStep(2);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    });
  }

  function addStudent() {
    if (!schoolId || !gradeLevel) {
      setError("Selecciona centro y curso.");
      return;
    }

    setStudents((current) => [
      ...current,
      {
        id: safeId("student"),
        alias: alias.trim(),
        schoolId,
        gradeLevel,
        academicYear,
      },
    ]);
    setAlias("");
    setSchoolId("");
    setGradeLevel("");
    setError("");
  }

  function removeStudent(id: string) {
    setStudents((current) => current.filter((student) => student.id !== id));
  }

  function finish() {
    let studentsToPersist = [...students];
    const hasDraftStudent = Boolean(alias.trim() || schoolId || gradeLevel);

    if (accountType === "parent" && hasDraftStudent) {
      if (!schoolId || !gradeLevel) {
        setError("Completa centro y curso del estudiante antes de continuar.");
        return;
      }

      studentsToPersist = [
        ...studentsToPersist,
        {
          id: safeId("student"),
          alias: alias.trim(),
          schoolId,
          gradeLevel,
          academicYear,
        },
      ];
    }

    if (studentsToPersist.length === 0) {
      setError(accountType === "student" ? "Añade tu centro y curso." : "Añade al menos un estudiante.");
      return;
    }

    const learners = studentsToPersist.map((student, index) => ({
      id: student.id,
      label:
        accountType === "student"
          ? "Mi curso"
          : student.alias.trim() || "Estudiante " + (index + 1),
      schoolId: student.schoolId,
      gradeLevel: student.gradeLevel,
      academicYear: student.academicYear,
    }));

    window.localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        accountType,
        postalCode: postalCode.trim(),
        academicYear,
        students: learners,
        completedAt: new Date().toISOString(),
      })
    );
    window.localStorage.setItem(
      COURSE_STORAGE_KEY,
      JSON.stringify({
        learners,
        needs: [],
      })
    );
    window.localStorage.removeItem(SUPPRESS_PROFILE_KEY);

    router.push("/marketplace?profile_demo=1");
  }

  const schoolById = useMemo(
    () => new Map(schools.map((school) => [school.id, school])),
    [schools]
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-6 text-center">
        <Badge variant="secondary">Prototipo de alta · Preview</Badge>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          {step === 1 ? "Configura solo lo necesario" : accountType === "student" ? "Tu contexto educativo" : "Añade estudiantes"}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {step === 1
            ? "En la versión final, email y contraseña ya estarían creados. Aquí validamos únicamente los datos nuevos que Wetudy necesita para personalizar la experiencia."
            : accountType === "student"
              ? "Con centro y curso podemos enseñarte material más relevante. El año académico se asigna automáticamente."
              : "Empieza por uno. Puedes entrar en Wetudy en cuanto lo guardes o añadir más estudiantes ahora."}
        </p>
      </div>

      <div className="mb-5 flex items-center justify-center gap-2 text-xs">
        <span className={step === 1 ? "font-semibold text-primary" : "text-muted-foreground"}>1 · Cuenta</span>
        <span className="text-muted-foreground">→</span>
        <span className={step === 2 ? "font-semibold text-primary" : "text-muted-foreground"}>2 · {accountType === "student" ? "Tu curso" : "Estudiantes"}</span>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>¿Cómo vas a usar Wetudy?</CardTitle>
            <CardDescription>Esto solo cambia cómo organizamos tu contexto educativo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAccountType("student")}
                className={[
                  "rounded-2xl border p-4 text-left transition",
                  accountType === "student" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40",
                ].join(" ")}
              >
                <UserRound className="h-5 w-5 text-primary" />
                <p className="mt-3 font-semibold">Soy estudiante</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Wetudy organizará tu propio centro, curso y necesidades.</p>
              </button>
              <button
                type="button"
                onClick={() => setAccountType("parent")}
                className={[
                  "rounded-2xl border p-4 text-left transition",
                  accountType === "parent" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40",
                ].join(" ")}
              >
                <UsersRound className="h-5 w-5 text-primary" />
                <p className="mt-3 font-semibold">Familia / tutor</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Podrás gestionar uno o varios estudiantes desde la misma cuenta.</p>
              </button>
            </div>

            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Código postal</span>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  inputMode="numeric"
                  maxLength={5}
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="28001"
                  className="h-11 w-full rounded-md border bg-background pl-10 pr-3 text-base"
                />
              </div>
              <p className="text-xs text-muted-foreground">Lo usamos para proximidad. No necesitamos tu dirección exacta.</p>
            </label>

            <Button type="button" className="w-full" onClick={continueAccount}>
              Continuar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {students.length > 0 ? (
            <div className="space-y-2">
              {students.map((student, index) => {
                const school = schoolById.get(student.schoolId);
                return (
                  <Card key={student.id}>
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {accountType === "student" ? "Tu curso" : student.alias || "Estudiante " + (index + 1)}
                        </p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {school?.name || "Centro"} · {student.gradeLevel} · {student.academicYear}
                        </p>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeStudent(student.id)}>
                        Cambiar
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : null}

          {(accountType === "parent" || students.length === 0) ? (
            <Card className={students.length > 0 ? "border-dashed" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GraduationCap className="h-5 w-5" />
                  {accountType === "student"
                    ? "Centro y curso"
                    : students.length === 0
                      ? "Estudiante 1"
                      : "Añadir otro estudiante"}
                </CardTitle>
                <CardDescription>
                  No pedimos nombre, edad ni otros datos personales del estudiante.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {accountType === "parent" ? (
                  <label className="space-y-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">
                      Nombre o alias <span className="font-normal text-muted-foreground">(opcional)</span>
                    </span>
                    <input
                      value={alias}
                      onChange={(event) => setAlias(event.target.value)}
                      maxLength={60}
                      autoComplete="off"
                      placeholder="Ej. Ana, ESO, Estudiante mayor…"
                      className="h-11 w-full rounded-md border bg-background px-3 text-base"
                    />
                    <p className="text-xs text-muted-foreground">
                      Solo sirve para identificarlo dentro de tu cuenta. Si lo dejas vacío usaremos Estudiante {students.length + 1}.
                    </p>
                  </label>
                ) : null}
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Centro</span>
                  <select
                    value={schoolId}
                    onChange={(event) => setSchoolId(event.target.value)}
                    className="h-11 w-full rounded-md border bg-background px-3"
                  >
                    <option value="">Selecciona centro</option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}{school.city ? " · " + school.city : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Curso</span>
                  <select
                    value={gradeLevel}
                    onChange={(event) => setGradeLevel(event.target.value)}
                    className="h-11 w-full rounded-md border bg-background px-3"
                  >
                    <option value="">Selecciona curso</option>
                    {gradeLevels.map((grade) => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </label>
                <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant={students.length === 0 ? "default" : "outline"} onClick={addStudent}>
                    <Plus className="mr-2 h-4 w-4" />
                    {accountType === "student" ? "Guardar mi curso" : students.length === 0 ? "Guardar estudiante" : "Añadir estudiante"}
                  </Button>
                  {students.length === 0 ? (
                    <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                      Volver
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {students.length > 0 ? (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-semibold">Ya puedes entrar en Wetudy</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      {accountType === "parent"
                        ? "No necesitas completar nada más. Si quieres, puedes añadir otro estudiante antes de continuar."
                        : "No necesitas completar nada más para empezar."}
                    </p>
                    <Button type="button" className="mt-3" onClick={finish}>
                      Entrar en Wetudy
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
