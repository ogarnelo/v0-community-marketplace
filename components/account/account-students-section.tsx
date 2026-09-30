"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AccountType = "student" | "parent";

export type AccountStudentRow = {
  id: string;
  relationship: "self" | "guardian";
  alias: string | null;
  school_id: string | null;
  grade_level: string;
  academic_year: string;
  is_primary: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type SchoolOption = {
  id: string;
  name: string;
  city: string | null;
};

type Draft = {
  alias: string;
  schoolId: string;
  gradeLevel: string;
};

const EMPTY_DRAFT: Draft = {
  alias: "",
  schoolId: "",
  gradeLevel: "",
};

function getStudentLabel(
  student: AccountStudentRow,
  index: number,
  accountType: AccountType
) {
  const alias = student.alias?.trim();
  if (alias) return alias;
  return accountType === "student" ? "Mi curso" : "Estudiante " + (index + 1);
}

export default function AccountStudentsSection({
  accountType,
  initialStudents,
  schools,
  gradeLevels,
}: {
  accountType: AccountType;
  initialStudents: AccountStudentRow[];
  schools: SchoolOption[];
  gradeLevels: string[];
}) {
  const router = useRouter();
  const [students, setStudents] = useState(initialStudents);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(initialStudents.length === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const schoolById = useMemo(
    () => new Map(schools.map((school) => [school.id, school])),
    [schools]
  );

  function resetEditor() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setAdding(false);
    setError("");
  }

  function startAdd() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setAdding(true);
    setPendingDeleteId(null);
    setError("");
  }

  function startEdit(student: AccountStudentRow) {
    setDraft({
      alias: student.alias || "",
      schoolId: student.school_id || "",
      gradeLevel: student.grade_level || "",
    });
    setEditingId(student.id);
    setAdding(false);
    setPendingDeleteId(null);
    setError("");
  }

  function validate() {
    if (!draft.schoolId) {
      setError("Selecciona un centro.");
      return false;
    }
    if (!draft.gradeLevel) {
      setError("Selecciona un curso.");
      return false;
    }
    return true;
  }

  async function saveStudent() {
    if (!validate()) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        editingId ? "/api/account/students/" + editingId : "/api/account/students",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alias: draft.alias.trim() || null,
            schoolId: draft.schoolId,
            gradeLevel: draft.gradeLevel,
          }),
        }
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.student) {
        throw new Error(payload?.error || "No se pudo guardar el estudiante.");
      }

      const saved = payload.student as AccountStudentRow;

      setStudents((current) => {
        const alreadyExists = current.some((student) => student.id === saved.id);
        return alreadyExists
          ? current.map((student) => (student.id === saved.id ? saved : student))
          : [...current, saved];
      });

      resetEditor();
      router.refresh();
    } catch (cause: any) {
      setError(cause?.message || "No se pudo guardar el estudiante.");
    } finally {
      setSaving(false);
    }
  }

  async function removeStudent(student: AccountStudentRow) {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/account/students/" + student.id, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo quitar el estudiante.");
      }

      setStudents((current) => {
        const remaining = current.filter((item) => item.id !== student.id);
        if (student.is_primary && remaining.length > 0) {
          return remaining.map((item, index) =>
            index === 0 ? { ...item, is_primary: true } : item
          );
        }
        return remaining;
      });
      setPendingDeleteId(null);
      resetEditor();
      router.refresh();
    } catch (cause: any) {
      setError(cause?.message || "No se pudo quitar el estudiante.");
    } finally {
      setSaving(false);
    }
  }

  const canAdd =
    accountType === "parent" ||
    (accountType === "student" && students.length === 0);

  const showEditor = editingId !== null || adding;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {accountType === "student" ? (
                <UserRound className="h-5 w-5 text-primary" />
              ) : (
                <UsersRound className="h-5 w-5 text-primary" />
              )}
              {accountType === "student" ? "Mi contexto educativo" : "Estudiantes"}
            </CardTitle>
            <CardDescription className="mt-1.5">
              {accountType === "student"
                ? "Tu centro y curso se gestionan aquí, separados de los datos personales de la cuenta."
                : "Los datos del titular de la cuenta son independientes. Aquí gestionas los estudiantes asociados."}
            </CardDescription>
          </div>

          {canAdd && !showEditor ? (
            <Button type="button" variant="outline" onClick={startAdd}>
              <Plus className="mr-2 h-4 w-4" />
              {accountType === "student" ? "Añadir contexto" : "Añadir estudiante"}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {students.length > 0 ? (
          <div className="space-y-2">
            {students.map((student, index) => {
              const school = student.school_id
                ? schoolById.get(student.school_id)
                : null;
              const pendingDelete = pendingDeleteId === student.id;

              return (
                <div
                  key={student.id}
                  className="rounded-2xl border bg-background p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          {getStudentLabel(student, index, accountType)}
                        </p>
                        {student.is_primary && accountType === "parent" ? (
                          <Badge variant="outline">Principal</Badge>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <span>{school?.name || "Centro no disponible"}</span>
                        <span aria-hidden="true">·</span>
                        <span>{student.grade_level}</span>
                        <span aria-hidden="true">·</span>
                        <span>{student.academic_year}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(student)}
                        disabled={saving}
                      >
                        <Pencil className="mr-1.5 h-4 w-4" />
                        Editar
                      </Button>

                      {accountType === "parent" && !pendingDelete ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPendingDeleteId(student.id);
                            setEditingId(null);
                            setAdding(false);
                            setError("");
                          }}
                          disabled={saving}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" />
                          Quitar
                        </Button>
                      ) : null}

                      {accountType === "parent" && pendingDelete ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => void removeStudent(student)}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-1.5 h-4 w-4" />
                            )}
                            Confirmar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setPendingDeleteId(null)}
                            disabled={saving}
                          >
                            Cancelar
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !showEditor ? (
          <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
            {accountType === "student"
              ? "Todavía no has configurado tu centro y curso."
              : "Todavía no hay estudiantes asociados a esta cuenta."}
          </div>
        ) : null}

        {showEditor ? (
          <div className="rounded-2xl border border-dashed bg-muted/20 p-4">
            <div className="mb-4 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">
                  {editingId
                    ? accountType === "student"
                      ? "Editar mi contexto"
                      : "Editar estudiante"
                    : accountType === "student"
                      ? "Añadir mi contexto"
                      : "Añadir estudiante"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Nombre o alias es opcional. Centro y curso son obligatorios.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="account-student-alias">
                  Nombre o alias <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="account-student-alias"
                  value={draft.alias}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      alias: event.target.value.slice(0, 80),
                    }))
                  }
                  placeholder={
                    accountType === "student"
                      ? "Ej. Mi curso"
                      : "Ej. Ana, Mayor, ESO…"
                  }
                  autoComplete="off"
                  className="text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-student-school">Centro</Label>
                <select
                  id="account-student-school"
                  value={draft.schoolId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      schoolId: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-base sm:text-sm"
                >
                  <option value="">Selecciona centro</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                      {school.city ? " · " + school.city : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-student-grade">Curso</Label>
                <select
                  id="account-student-grade"
                  value={draft.gradeLevel}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      gradeLevel: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-base sm:text-sm"
                >
                  <option value="">Selecciona curso</option>
                  {gradeLevels.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                onClick={() => void saveStudent()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {editingId ? "Guardar cambios" : "Guardar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetEditor}
                disabled={saving}
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
