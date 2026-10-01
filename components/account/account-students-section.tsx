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
import StudentContextFields, {
  type StudentContextSchoolOption,
} from "@/components/account-students/student-context-fields";

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

function draftFromStudent(
  student: AccountStudentRow | null,
  defaultSchoolId = ""
): Draft {
  return student
    ? {
        alias: student.alias || "",
        schoolId: student.school_id || defaultSchoolId,
        gradeLevel: student.grade_level || "",
      }
    : {
        ...EMPTY_DRAFT,
        schoolId: defaultSchoolId,
      };
}

function getStudentLabel(
  student: AccountStudentRow,
  index: number
) {
  return student.alias?.trim() || "Estudiante " + (index + 1);
}

export default function AccountStudentsSection({
  accountType,
  initialStudents,
  schools,
  gradeLevels,
  defaultSchoolId = "",
}: {
  accountType: AccountType;
  initialStudents: AccountStudentRow[];
  schools: StudentContextSchoolOption[];
  gradeLevels: string[];
  defaultSchoolId?: string;
}) {
  const router = useRouter();
  const initialSelf = accountType === "student" ? initialStudents[0] || null : null;
  const [students, setStudents] = useState(initialStudents);
  const [draft, setDraft] = useState<Draft>(() =>
    draftFromStudent(initialSelf, defaultSchoolId)
  );
  const [editingId, setEditingId] = useState<string | null>(
    accountType === "student" ? initialSelf?.id || null : null
  );
  const [adding, setAdding] = useState(
    accountType === "student" ? true : initialStudents.length === 0
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const schoolById = useMemo(
    () => new Map(schools.map((school) => [school.id, school])),
    [schools]
  );

  function resetEditor() {
    setDraft(draftFromStudent(null, defaultSchoolId));
    setEditingId(null);
    setAdding(false);
    setError("");
    setSuccess("");
  }

  function startAdd() {
    setDraft(draftFromStudent(null, defaultSchoolId));
    setEditingId(null);
    setAdding(true);
    setPendingDeleteId(null);
    setError("");
    setSuccess("");
  }

  function startEdit(student: AccountStudentRow) {
    setDraft(draftFromStudent(student, defaultSchoolId));
    setEditingId(student.id);
    setAdding(false);
    setPendingDeleteId(null);
    setError("");
    setSuccess("");
  }

  function validate() {
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
    setSuccess("");

    try {
      const response = await fetch(
        editingId ? "/api/account/students/" + editingId : "/api/account/students",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alias: accountType === "student" ? null : draft.alias.trim() || null,
            schoolId: draft.schoolId || null,
            gradeLevel: draft.gradeLevel,
          }),
        }
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.student) {
        throw new Error(payload?.error || "No se pudo guardar el contexto educativo.");
      }

      const saved = payload.student as AccountStudentRow;

      setStudents((current) => {
        const alreadyExists = current.some((student) => student.id === saved.id);
        return alreadyExists
          ? current.map((student) => (student.id === saved.id ? saved : student))
          : [...current, saved];
      });

      if (accountType === "student") {
        setDraft(draftFromStudent(saved, defaultSchoolId));
        setEditingId(saved.id);
        setAdding(true);
        setSuccess("Contexto educativo actualizado.");
      } else {
        resetEditor();
      }

      router.refresh();
    } catch (cause: any) {
      setError(cause?.message || "No se pudo guardar el contexto educativo.");
    } finally {
      setSaving(false);
    }
  }

  async function removeStudent(student: AccountStudentRow) {
    setSaving(true);
    setError("");
    setSuccess("");

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

  if (accountType === "student") {
    const currentStudent = students[0] || null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            Mi contexto educativo
          </CardTitle>
          <CardDescription>
            Tu centro y curso se gestionan aquí, separados de los datos personales de la cuenta.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <StudentContextFields
            showAlias={false}
            alias=""
            onAliasChange={() => undefined}
            schoolId={draft.schoolId}
            onSchoolIdChange={(schoolId) =>
              setDraft((current) => ({ ...current, schoolId }))
            }
            gradeLevel={draft.gradeLevel}
            onGradeLevelChange={(gradeLevel) =>
              setDraft((current) => ({ ...current, gradeLevel }))
            }
            schools={schools}
            gradeLevels={gradeLevels}
            disabled={saving}
          />

          {currentStudent ? (
            <p className="text-xs text-muted-foreground">
              Curso académico {currentStudent.academic_year}.
            </p>
          ) : null}

          <Button
            type="button"
            onClick={() => void saveStudent()}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Guardar contexto educativo
          </Button>
        </CardContent>
      </Card>
    );
  }

  const showEditor = editingId !== null || adding;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-primary" />
              Estudiantes
            </CardTitle>
            <CardDescription className="mt-1.5">
              Los datos del titular de la cuenta son independientes. Aquí gestionas los estudiantes asociados.
            </CardDescription>
          </div>

          {!showEditor ? (
            <Button type="button" variant="outline" onClick={startAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Añadir estudiante
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
                          {getStudentLabel(student, index)}
                        </p>
                        {student.is_primary ? (
                          <Badge variant="outline">Principal</Badge>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <span>{school?.name || "Sin centro"}</span>
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

                      {!pendingDelete ? (
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
                      ) : (
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
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !showEditor ? (
          <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
            Todavía no hay estudiantes asociados a esta cuenta.
          </div>
        ) : null}

        {showEditor ? (
          <div className="rounded-2xl border border-dashed bg-muted/20 p-4">
            <div className="mb-4 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">
                  {editingId ? "Editar estudiante" : "Añadir estudiante"}
                </p>
                <p className="text-xs text-muted-foreground">
                  El nombre o alias es opcional. El centro también puede dejarse vacío.
                </p>
              </div>
            </div>

            <StudentContextFields
              showAlias
              alias={draft.alias}
              onAliasChange={(alias) =>
                setDraft((current) => ({ ...current, alias }))
              }
              schoolId={draft.schoolId}
              onSchoolIdChange={(schoolId) =>
                setDraft((current) => ({ ...current, schoolId }))
              }
              gradeLevel={draft.gradeLevel}
              onGradeLevelChange={(gradeLevel) =>
                setDraft((current) => ({ ...current, gradeLevel }))
              }
              schools={schools}
              gradeLevels={gradeLevels}
              disabled={saving}
            />

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
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
