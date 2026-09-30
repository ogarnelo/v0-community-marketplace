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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import StudentContextFields, {
  type StudentContextSchoolOption,
} from "@/components/account-students/student-context-fields";

type AccountType = "student" | "parent";

type StudentRow = {
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

function studentLabel(student: StudentRow, index: number) {
  return student.alias?.trim() || "Estudiante " + (index + 1);
}

export default function AccountStudentsOnboarding({
  accountType,
  accountHolderName,
  initialStudents,
  schools,
  gradeLevels,
  nextPath,
}: {
  accountType: AccountType;
  accountHolderName: string;
  initialStudents: StudentRow[];
  schools: StudentContextSchoolOption[];
  gradeLevels: string[];
  nextPath: string | null;
}) {
  const router = useRouter();
  const initialSelf = accountType === "student" ? initialStudents[0] || null : null;
  const [students, setStudents] = useState(initialStudents);
  const [draft, setDraft] = useState<Draft>(() =>
    initialSelf
      ? {
          alias: "",
          schoolId: initialSelf.school_id || "",
          gradeLevel: initialSelf.grade_level || "",
        }
      : EMPTY_DRAFT
  );
  const [editingId, setEditingId] = useState<string | null>(
    accountType === "student" ? initialSelf?.id || null : null
  );
  const [addingAnother, setAddingAnother] = useState(initialStudents.length === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const schoolById = useMemo(
    () => new Map(schools.map((school) => [school.id, school])),
    [schools]
  );

  const showEditor =
    accountType === "student" ||
    students.length === 0 ||
    editingId !== null ||
    addingAnother;

  function resetEditor() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setAddingAnother(false);
    setError("");
  }

  function startEdit(student: StudentRow) {
    setDraft({
      alias: accountType === "student" ? "" : student.alias || "",
      schoolId: student.school_id || "",
      gradeLevel: student.grade_level || "",
    });
    setEditingId(student.id);
    setAddingAnother(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startAnother() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setAddingAnother(true);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveDraft() {
    if (!draft.gradeLevel) {
      setError("Selecciona un curso.");
      return null;
    }

    setSaving(true);
    setError("");

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

      const saved = payload.student as StudentRow;

      setStudents((current) => {
        const exists = current.some((student) => student.id === saved.id);
        return exists
          ? current.map((student) => (student.id === saved.id ? saved : student))
          : [...current, saved];
      });

      if (accountType === "student") {
        setEditingId(saved.id);
        setDraft({
          alias: "",
          schoolId: saved.school_id || "",
          gradeLevel: saved.grade_level || "",
        });
      } else {
        resetEditor();
      }

      return saved;
    } catch (cause: any) {
      setError(cause?.message || "No se pudo guardar el contexto educativo.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function removeStudent(student: StudentRow) {
    if (accountType === "student") return;

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

      setAddingAnother(false);
      setEditingId(null);
    } catch (cause: any) {
      setError(cause?.message || "No se pudo quitar el estudiante.");
    } finally {
      setSaving(false);
    }
  }

  async function enterWetudy() {
    const hasDraft = Boolean(draft.alias.trim() || draft.schoolId || draft.gradeLevel);

    if (showEditor && hasDraft) {
      const saved = await saveDraft();
      if (!saved) return;
    }

    if (students.length === 0 && !hasDraft) {
      setError(
        accountType === "student"
          ? "Selecciona tu curso antes de continuar."
          : "Añade al menos un estudiante antes de continuar."
      );
      return;
    }

    router.push(nextPath || "/marketplace");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
        <div className="mb-5 text-center">
          <Badge variant="secondary">Paso 2 de 2</Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {accountType === "student" ? "Tu contexto educativo" : "Estudiantes"}
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {accountType === "student"
              ? "Indica tu curso y, si quieres, tu centro educativo. Podrás modificarlos más adelante desde Mi cuenta."
              : "Añade el primer estudiante y ya podrás entrar en Wetudy. Los demás son opcionales."}
          </p>
          {accountHolderName ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Cuenta de {accountHolderName}
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {accountType === "parent" && students.length > 0 ? (
          <div className="mb-4 space-y-2">
            {students.map((student, index) => {
              const school = student.school_id
                ? schoolById.get(student.school_id)
                : null;

              return (
                <Card key={student.id}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{studentLabel(student, index)}</p>
                        {student.is_primary ? (
                          <Badge variant="outline">Principal</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {school?.name || "Sin centro"} · {student.grade_level} · {student.academic_year}
                      </p>
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
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void removeStudent(student)}
                        disabled={saving}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Quitar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}

        {showEditor ? (
          <Card className={students.length > 0 && accountType === "parent" ? "border-dashed" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {accountType === "student" ? (
                  <UserRound className="h-5 w-5 text-primary" />
                ) : (
                  <UsersRound className="h-5 w-5 text-primary" />
                )}
                {accountType === "student"
                  ? "Centro y curso"
                  : editingId
                    ? "Editar estudiante"
                    : students.length === 0
                      ? "Estudiante 1"
                      : "Añadir otro estudiante"}
              </CardTitle>
              <CardDescription>
                {accountType === "student"
                  ? "El centro es opcional. El curso nos ayuda a personalizar Wetudy."
                  : "Nombre o alias y centro son opcionales. El curso es necesario."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <StudentContextFields
                showAlias={accountType === "parent"}
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

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" onClick={() => void saveDraft()} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {editingId ? "Guardar cambios" : "Guardar"}
                </Button>
                {accountType === "parent" && students.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetEditor}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {students.length > 0 ? (
          <Card className="mt-4 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <GraduationCap className="mt-0.5 h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold">Tu cuenta está preparada</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {accountType === "parent"
                      ? "Puedes entrar ya o añadir otro estudiante. También podrás gestionarlos desde Mi cuenta."
                      : "Tu contexto educativo ya está guardado."}
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button type="button" onClick={() => void enterWetudy()} disabled={saving}>
                      Entrar en Wetudy
                    </Button>
                    {accountType === "parent" && !showEditor ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={startAnother}
                        disabled={saving}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Añadir otro estudiante
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
