"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GraduationCap, MapPin, Plus, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SchoolOption = {
  id: string;
  name: string;
  city: string | null;
};

type Learner = {
  id: string;
  label: string;
  schoolId: string;
  gradeLevel: string;
  academicYear: string;
};

type AccountContext = {
  accountType: "student" | "parent";
  postalCode: string;
  academicYear: string;
  students: Learner[];
};

const ONBOARDING_STORAGE_KEY = "wetudy_onboarding_beta_v1";
const COURSE_STORAGE_KEY = "wetudy_my_course_beta_v0";

function safeId(prefix: string) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

export default function AccountStudentsBetaClient({
  schools,
  gradeLevels,
}: {
  schools: SchoolOption[];
  gradeLevels: string[];
}) {
  const [context, setContext] = useState<AccountContext | null>(null);
  const [schoolId, setSchoolId] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [adding, setAdding] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          (parsed?.accountType === "student" || parsed?.accountType === "parent") &&
          Array.isArray(parsed?.students)
        ) {
          setContext(parsed);
        }
      }
    } catch {
      // Mantener la vista utilizable aunque el almacenamiento local esté corrupto.
    } finally {
      setHydrated(true);
    }
  }, []);

  const schoolById = useMemo(
    () => new Map(schools.map((school) => [school.id, school])),
    [schools]
  );

  function persist(next: AccountContext) {
    setContext(next);
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next));

    const currentCourseRaw = window.localStorage.getItem(COURSE_STORAGE_KEY);
    let existingNeeds = [];
    try {
      existingNeeds = currentCourseRaw ? JSON.parse(currentCourseRaw)?.needs || [] : [];
    } catch {
      existingNeeds = [];
    }

    window.localStorage.setItem(
      COURSE_STORAGE_KEY,
      JSON.stringify({
        learners: next.students,
        needs: existingNeeds,
      })
    );
  }

  function addStudent() {
    if (!context || context.accountType !== "parent" || !schoolId || !gradeLevel) return;

    const nextStudents = [
      ...context.students,
      {
        id: safeId("student"),
        label: "Estudiante " + (context.students.length + 1),
        schoolId,
        gradeLevel,
        academicYear: context.academicYear,
      },
    ];

    persist({ ...context, students: nextStudents });
    setSchoolId("");
    setGradeLevel("");
    setAdding(false);
  }

  if (!hydrated) {
    return <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-muted-foreground">Preparando la cuenta…</div>;
  }

  if (!context) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Aún no has configurado el contexto educativo</CardTitle>
            <CardDescription>Completa el onboarding corto para probar esta parte de la cuenta.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/beta/onboarding">Configurar ahora</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="secondary">Vista de cuenta · Preview</Badge>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Mi cuenta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Los datos generales de la cuenta van separados del contexto de cada estudiante.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/marketplace?profile_demo=1">Volver al Marketplace</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cuenta</CardTitle>
            <CardDescription>Datos que pertenecen al usuario, no a un estudiante concreto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
              {context.accountType === "student" ? <UserRound className="h-5 w-5 text-primary" /> : <UsersRound className="h-5 w-5 text-primary" />}
              <div>
                <p className="text-xs text-muted-foreground">Tipo de cuenta</p>
                <p className="font-medium">{context.accountType === "student" ? "Estudiante" : "Familia / tutor"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Código postal</p>
                <p className="font-medium">{context.postalCode}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {context.accountType === "student" ? "Mi contexto educativo" : "Estudiantes"}
            </CardTitle>
            <CardDescription>
              {context.accountType === "student"
                ? "Tu centro y curso alimentan Mi curso, recomendaciones y avisos."
                : "Cada estudiante tiene su propio centro, curso, necesidades y recomendaciones."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {context.students.map((student, index) => {
              const school = schoolById.get(student.schoolId);
              return (
                <div key={student.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <GraduationCap className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">
                        {context.accountType === "student" ? "Tu curso" : "Estudiante " + (index + 1)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {school?.name || "Centro"} · {student.gradeLevel}
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/beta/mi-curso?profile_demo=1">Abrir Mi curso</Link>
                  </Button>
                </div>
              );
            })}

            {context.accountType === "parent" ? (
              !adding ? (
                <Button type="button" variant="ghost" className="justify-start px-0 text-primary hover:text-primary" onClick={() => setAdding(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Añadir estudiante
                </Button>
              ) : (
                <div className="rounded-xl border border-dashed p-3">
                  <p className="mb-3 text-sm font-semibold">Nuevo estudiante</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={schoolId}
                      onChange={(event) => setSchoolId(event.target.value)}
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">Selecciona centro</option>
                      {schools.map((school) => (
                        <option key={school.id} value={school.id}>{school.name}</option>
                      ))}
                    </select>
                    <select
                      value={gradeLevel}
                      onChange={(event) => setGradeLevel(event.target.value)}
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">Selecciona curso</option>
                      {gradeLevels.map((grade) => (
                        <option key={grade} value={grade}>{grade}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" size="sm" onClick={addStudent} disabled={!schoolId || !gradeLevel}>
                      Añadir
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
