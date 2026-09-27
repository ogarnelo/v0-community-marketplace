import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type StudentRelationship = "self" | "guardian";

export type AccountStudentInput = {
  alias: string | null;
  schoolId: string;
  gradeLevel: string;
};

type AccountType = "student" | "parent";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ALIAS_LENGTH = 80;
const MAX_GRADE_LENGTH = 80;

export class AccountStudentError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "invalid_request") {
    super(message);
    this.name = "AccountStudentError";
    this.status = status;
    this.code = code;
  }
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function currentAcademicYear() {
  const now = new Date();
  const startYear = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return startYear + "/" + String((startYear + 1) % 100).padStart(2, "0");
}

export function parseStudentInput(body: any): AccountStudentInput {
  const alias = cleanText(body?.alias, MAX_ALIAS_LENGTH);
  const schoolId = cleanText(body?.schoolId, 64);
  const gradeLevel = cleanText(body?.gradeLevel, MAX_GRADE_LENGTH);

  if (!UUID_RE.test(schoolId)) {
    throw new AccountStudentError("Selecciona un centro válido.");
  }

  if (!gradeLevel) {
    throw new AccountStudentError("Selecciona un curso válido.");
  }

  return {
    alias: alias || null,
    schoolId,
    gradeLevel,
  };
}

export async function getAccountType(userId: string): Promise<AccountType> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("user_type")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!profile) {
    throw new AccountStudentError("No se ha encontrado tu perfil.", 404, "profile_not_found");
  }

  if (profile.user_type !== "student" && profile.user_type !== "parent") {
    throw new AccountStudentError(
      "Esta función está disponible para cuentas de estudiante y familia / tutor.",
      403,
      "unsupported_account_type"
    );
  }

  return profile.user_type;
}

export function relationshipForAccountType(accountType: AccountType): StudentRelationship {
  return accountType === "student" ? "self" : "guardian";
}

export async function ensureActiveSchool(schoolId: string) {
  const admin = createAdminClient();
  const { data: school, error } = await admin
    .from("schools")
    .select("id, name, is_active")
    .eq("id", schoolId)
    .maybeSingle();

  if (error) throw error;
  if (!school || !school.is_active) {
    throw new AccountStudentError("El centro seleccionado ya no está disponible.", 400, "school_unavailable");
  }

  return school;
}

export async function listAccountStudents(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_students")
    .select("id, relationship, alias, school_id, grade_level, academic_year, is_primary, active, sort_order, created_at, updated_at")
    .eq("owner_user_id", userId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createAccountStudent(userId: string, input: AccountStudentInput) {
  const admin = createAdminClient();
  const [accountType] = await Promise.all([
    getAccountType(userId),
    ensureActiveSchool(input.schoolId),
  ]);

  const relationship = relationshipForAccountType(accountType);
  const existing = await listAccountStudents(userId);

  if (accountType === "student" && existing.length > 0) {
    throw new AccountStudentError(
      "Una cuenta de estudiante solo puede gestionar su propio contexto educativo.",
      409,
      "student_context_exists"
    );
  }

  const nextSortOrder =
    existing.reduce((max, student) => Math.max(max, Number(student.sort_order) || 0), -1) + 1;
  const isPrimary = existing.length === 0;

  const { data, error } = await admin
    .from("account_students")
    .insert({
      owner_user_id: userId,
      relationship,
      alias: input.alias,
      school_id: input.schoolId,
      grade_level: input.gradeLevel,
      academic_year: currentAcademicYear(),
      is_primary: isPrimary,
      active: true,
      sort_order: nextSortOrder,
    })
    .select("id, relationship, alias, school_id, grade_level, academic_year, is_primary, active, sort_order, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AccountStudentError(
        "Ese contexto educativo ya no se puede crear en el estado actual de la cuenta.",
        409,
        "student_conflict"
      );
    }
    throw error;
  }

  return data;
}

export async function updateAccountStudent(
  userId: string,
  studentId: string,
  input: AccountStudentInput
) {
  if (!UUID_RE.test(studentId)) {
    throw new AccountStudentError("El estudiante no es válido.");
  }

  const admin = createAdminClient();
  const [accountType] = await Promise.all([
    getAccountType(userId),
    ensureActiveSchool(input.schoolId),
  ]);
  const expectedRelationship = relationshipForAccountType(accountType);

  const { data: existing, error: existingError } = await admin
    .from("account_students")
    .select("id, relationship, active")
    .eq("id", studentId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing || !existing.active) {
    throw new AccountStudentError("Ese estudiante ya no está disponible.", 404, "student_not_found");
  }

  if (existing.relationship !== expectedRelationship) {
    throw new AccountStudentError(
      "El tipo de cuenta ha cambiado y este contexto necesita una revisión antes de editarse.",
      409,
      "relationship_mismatch"
    );
  }

  const { data, error } = await admin
    .from("account_students")
    .update({
      alias: input.alias,
      school_id: input.schoolId,
      grade_level: input.gradeLevel,
      updated_at: new Date().toISOString(),
    })
    .eq("id", studentId)
    .eq("owner_user_id", userId)
    .select("id, relationship, alias, school_id, grade_level, academic_year, is_primary, active, sort_order, created_at, updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateAccountStudent(userId: string, studentId: string) {
  if (!UUID_RE.test(studentId)) {
    throw new AccountStudentError("El estudiante no es válido.");
  }

  const admin = createAdminClient();
  const accountType = await getAccountType(userId);

  const { data: existing, error: existingError } = await admin
    .from("account_students")
    .select("id, relationship, is_primary, active")
    .eq("id", studentId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing || !existing.active) {
    throw new AccountStudentError("Ese estudiante ya no está disponible.", 404, "student_not_found");
  }

  if (accountType === "student") {
    throw new AccountStudentError(
      "Una cuenta de estudiante no puede eliminar su propio contexto educativo. Puedes editarlo.",
      409,
      "self_context_required"
    );
  }

  const { error: deactivateError } = await admin
    .from("account_students")
    .update({
      active: false,
      is_primary: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", studentId)
    .eq("owner_user_id", userId);

  if (deactivateError) throw deactivateError;

  if (existing.is_primary) {
    const { data: nextPrimary, error: nextError } = await admin
      .from("account_students")
      .select("id")
      .eq("owner_user_id", userId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextError) throw nextError;

    if (nextPrimary?.id) {
      const { error: promoteError } = await admin
        .from("account_students")
        .update({
          is_primary: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", nextPrimary.id)
        .eq("owner_user_id", userId);

      if (promoteError) throw promoteError;
    }
  }

  return { id: studentId, active: false };
}
