"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  GraduationCap,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AccountType = "student" | "parent";

type AccountSummary = {
  firstName: string;
  lastName: string;
  email: string;
  postalCode: string;
  accountType: AccountType;
};

type SchoolOption = {
  id: string;
  name: string;
  city: string | null;
};

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

function studentLabel(student: StudentRow, index: number, accountType: AccountType) {
  if (student.alias?.trim()) return student.alias.trim();
  return accountType === "student" ? "Mi curso" : "Estudiante " + (index + 1);
}

export default function RealStudentOnboardingPreview({
  account,
  schools,
  gradeLevels,
}: {
  account: AccountSummary;
  schools: SchoolOption[];
  gradeLevels: string[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [addingAnother, setAddingAnother] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const schoolById = useMemo(
    () => new Map(schools.map((school) => [school.id, school])),
    [schools]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadStudents() {
      try {
        const response = await fetch("/api/account/students", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error || "No se pudieron cargar los estudiantes.");
        }

        if (!cancelled) {
          setStudents(Array.isArray(payload?.students) ? payload.students : []);
        }
      } catch (cause: any) {
        if (!cancelled) setError(cause?.message || "No se pudieron cargar los estudiantes.");
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    }

    void loadStudents();

    return () => {
      cancelled = true;
    };
  }, []);

  function goToStudents() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    setError("");
    setStep(2);
  }

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
    setAddingAnother(false);
    setEditingId(null);
  }

  function startEdit(student: StudentRow) {
    setDraft({
      alias: student.alias || "",
      schoolId: student.school_id || "",
      gradeLevel: student.grade_level || "",
    });
    setEditingId(student.id);
    setAddingAnother(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateDraft() {
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

  async function saveDraft() {
    if (!validateDraft()) return null;

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

      const saved = payload.student as StudentRow;

      setStudents((current) => {
        const exists = current.some((student) => student.id === saved.id);
        if (exists) {
          return current.map((student) => (student.id === saved.id ? saved : student));
        }
        return [...current, saved];
      });

      resetDraft();
      return saved;
    } catch (cause: any) {
      setError(cause?.message || "No se pudo guardar el estudiante.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(student: StudentRow) {
    if (account.accountType === "student") return;

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
    } catch (cause: any) {
      setError(cause?.message || "No se pudo quitar el estudiante.");
    } finally {
      setSaving(false);
    }
  }

  async function enterWetudy() {
    const draftHasAnyValue = Boolean(
      draft.alias.trim() || draft.schoolId || draft.gradeLevel
    );

    if ((addingAnother || editingId) && draftHasAnyValue) {
      if (!draft.schoolId || !draft.gradeLevel) {
        setError("Completa centro y curso antes de continuar, o cancela este estudiante.");
        return;
      }

      const saved = await saveDraft();
      if (!saved) return;
    }

    if (students.length === 0 && !(addingAnother || editingId)) {
      setError(
        account.accountType === "student"
          ? "Configura tu centro y curso antes de continuar."
          : "Añade al menos un estudiante antes de continuar."
      );
      return;
    }

    router.push("/marketplace");
  }

  const showCreateForm =
    step === 2 &&
    (students.length === 0 ||
      editingId !== null ||
      (account.accountType === "parent" && addingAnother));

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
        <div className="mb-5 text-center">
          <Badge variant="secondary">Preview · datos reales de estudiantes</Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {step === 1 ? "Crea tu cuenta sin perder tiempo" : account.accountType === "student" ? "Tu contexto educativo" : "Estudiantes"}
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {step === 1
              ? "Esta pantalla reproduce cómo quedaría la primera parte del alta. En esta Preview no modifica tu cuenta actual."
              : account.accountType === "student"
                ? "Centro y curso se guardan como tu contexto educativo real."
                : "Añade uno y entra en Wetudy. Los demás son opcionales y se pueden añadir ahora o más adelante."}
          </p>
        </div>

        <div className="mb-5 flex items-center justify-center gap-2 text-xs">
          <span className={step === 1 ? "font-semibold text-primary" : "text-muted-foreground"}>
            1 · Cuenta
          </span>
          <span className="text-muted-foreground">→</span>
          <span className={step === 2 ? "font-semibold text-primary" : "text-muted-foreground"}>
            2 · {account.accountType === "student" ? "Tu curso" : "Estudiantes"}
          </span>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {step === 1 ? (
          <Card>
            <CardHeader>
              <CardTitle>Datos del titular de la cuenta</CardTitle>
              <CardDescription>
                Para Familia / tutor, nombre y apellidos corresponden al representante de la cuenta, no a los estudiantes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Nombre</p>
                  <p className="mt-1 font-medium">{account.firstName || "—"}</p>
                </div>
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Apellidos</p>
                  <p className="mt-1 font-medium">{account.lastName || "—"}</p>
                </div>
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="mt-1 break-all font-medium">{account.email}</p>
                </div>
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Tipo de cuenta</p>
                  <div className="mt-1 flex items-center gap-2 font-medium">
                    {account.accountType === "student" ? (
                      <UserRound className="h-4 w-4 text-primary" />
                    ) : (
                      <UsersRound className="h-4 w-4 text-primary" />
                    )}
                    {account.accountType === "student" ? "Estudiante" : "Familia / tutor"}
                  </div>
                </div>
                <div className="rounded-xl border bg-background p-3 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Código postal</p>
                  <div className="mt-1 flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4 text-primary" />
                    {account.postalCode || "Sin código postal"}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                En el alta definitiva estos serán campos de entrada junto con la contraseña. Aquí se muestran tus datos existentes para no modificar el signup de producción.
              </div>

              <Button type="button" className="w-full" onClick={goToStudents}>
                Continuar
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {loadingStudents ? (
              <Card>
                <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando contexto educativo…
                </CardContent>
              </Card>
            ) : null}

            {!loadingStudents && students.length > 0 ? (
              <div className="space-y-2">
                {students.map((student, index) => {
                  const school = student.school_id ? schoolById.get(student.school_id) : null;
                  return (
                    <Card key={student.id}>
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{studentLabel(student, index, account.accountType)}</p>
                            {student.is_primary && account.accountType === "parent" ? (
                              <Badge variant="outline">Principal</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {school?.name || "Centro no disponible"} · {student.grade_level} · {student.academic_year}
                          </p>
                        </div>
                        <div className="flex gap-2">
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
                          {account.accountType === "parent" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => void deactivate(student)}
                              disabled={saving}
                            >
                              <Trash2 className="mr-1.5 h-4 w-4" />
                              Quitar
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : null}

            {!loadingStudents && showCreateForm ? (
              <Card className={students.length > 0 ? "border-dashed" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GraduationCap className="h-5 w-5" />
                    {editingId
                      ? "Editar estudiante"
                      : account.accountType === "student"
                        ? "Centro y curso"
                        : students.length === 0
                          ? "Estudiante 1"
                          : "Añadir otro estudiante"}
                  </CardTitle>
                  <CardDescription>
                    Nombre o alias es opcional. No pedimos fecha de nacimiento ni otros datos personales.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium">Nombre o alias <span className="font-normal text-muted-foreground">(opcional)</span></span>
                    <input
                      value={draft.alias}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, alias: event.target.value.slice(0, 80) }))
                      }
                      placeholder={account.accountType === "student" ? "Ej. Mi curso" : "Ej. Ana, Mayor, ESO…"}
                      autoComplete="off"
                      className="h-11 w-full rounded-md border bg-background px-3 text-base sm:text-sm"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5 text-sm">
                      <span className="font-medium">Centro</span>
                      <select
                        value={draft.schoolId}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, schoolId: event.target.value }))
                        }
                        className="h-11 w-full rounded-md border bg-background px-3 text-base sm:text-sm"
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
                        value={draft.gradeLevel}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, gradeLevel: event.target.value }))
                        }
                        className="h-11 w-full rounded-md border bg-background px-3 text-base sm:text-sm"
                      >
                        <option value="">Selecciona curso</option>
                        {gradeLevels.map((grade) => (
                          <option key={grade} value={grade}>{grade}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" onClick={() => void saveDraft()} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      {editingId ? "Guardar cambios" : account.accountType === "student" ? "Guardar mi curso" : "Guardar estudiante"}
                    </Button>
                    {(editingId || students.length > 0) ? (
                      <Button type="button" variant="outline" onClick={resetDraft} disabled={saving}>
                        Cancelar
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {!loadingStudents && students.length > 0 ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-semibold">Ya puedes entrar en Wetudy</p>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">
                        {account.accountType === "parent"
                          ? "Puedes entrar ya o añadir otro estudiante. También podrás gestionarlos más adelante desde Mi cuenta."
                          : "Tu contexto educativo ya está guardado."}
                      </p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Button type="button" onClick={() => void enterWetudy()} disabled={saving}>
                          Entrar en Wetudy
                        </Button>
                        {account.accountType === "parent" && !addingAnother && !editingId ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setAddingAnother(true);
                              setDraft(EMPTY_DRAFT);
                              setError("");
                            }}
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

            <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={saving}>
              Volver a datos de cuenta
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
