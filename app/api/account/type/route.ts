import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
type AccountType = "student" | "parent";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status, headers: PRIVATE_HEADERS });
}

export async function PATCH(request: Request) {
  let user;
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const guest = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return guest
        ? jsonError("Debes iniciar sesión.", 401, "unauthorized")
        : jsonError("No se pudo comprobar tu sesión.", 503, "auth_unavailable");
    }
    user = authData?.user ?? null;
  } catch {
    return jsonError("No se pudo comprobar tu sesión.", 503, "auth_unavailable");
  }
  if (!user) return jsonError("Debes iniciar sesión.", 401, "unauthorized");
  if (!user.email_confirmed_at) {
    return jsonError("Confirma tu email antes de cambiar el tipo de cuenta.", 403, "email_not_confirmed");
  }

  const body = await request.json().catch(() => null);
  const targetType =
    body?.userType === "student" || body?.userType === "parent"
      ? (body.userType as AccountType)
      : null;

  if (!targetType) {
    return jsonError("Tipo de cuenta no válido.", 400, "invalid_account_type");
  }

  const admin = createAdminClient();

  const [{ data: profile, error: profileError }, { data: students, error: studentsError }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle(),
      admin
        .from("account_students")
        .select("id, relationship, alias, is_primary, active")
        .eq("owner_user_id", user.id)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  if (profileError || !profile) {
    console.error("account_type_profile_load_failed");
    return jsonError("No se pudo cargar tu perfil.", 500, "profile_load_failed");
  }

  if (studentsError) {
    console.error("account_type_students_load_failed");
    return jsonError(
      "No se pudieron revisar tus estudiantes.",
      500,
      "students_load_failed"
    );
  }

  const currentType =
    profile.user_type === "student" || profile.user_type === "parent"
      ? (profile.user_type as AccountType)
      : null;

  if (!currentType) {
    return jsonError(
      "Este cambio solo está disponible para cuentas de estudiante y familia / tutor.",
      409,
      "unsupported_current_type"
    );
  }

  if (currentType === targetType) {
    return NextResponse.json({ userType: targetType }, { headers: PRIVATE_HEADERS });
  }

  const activeStudents = students || [];

  if (targetType === "student" && activeStudents.length > 1) {
    return jsonError(
      "Para cambiar a Estudiante deja un solo estudiante activo en la cuenta.",
      409,
      "multiple_students_for_student_account"
    );
  }

  // Check Auth availability before changing any educational context or profile.
  // Auth and PostgreSQL cannot share a transaction; a failed preflight
  // must not start a partially applied DB transition.
  let existingAuthUser;
  try {
    const { data: authRecord, error: authLookupError } =
      await admin.auth.admin.getUserById(user.id);
    if (authLookupError || !authRecord?.user || authRecord.user.id !== user.id) {
      return jsonError(
        "No se pudo verificar la cuenta en Auth. Inténtalo más tarde.",
        503,
        "account_auth_preflight_unavailable"
      );
    }
    existingAuthUser = authRecord.user;
  } catch {
    return jsonError(
      "No se pudo verificar la cuenta en Auth. Inténtalo más tarde.",
      503,
      "account_auth_preflight_unavailable"
    );
  }

  const snapshots = activeStudents.map((student) => ({
    id: student.id,
    relationship: student.relationship,
    alias: student.alias,
    is_primary: student.is_primary,
  }));

  async function restoreStudents() {
    for (const snapshot of snapshots) {
      await admin
        .from("account_students")
        .update({
          relationship: snapshot.relationship,
          alias: snapshot.alias,
          is_primary: snapshot.is_primary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", snapshot.id)
        .eq("owner_user_id", user.id)
        .eq("active", true)
        .eq("relationship", targetType === "student" ? "self" : "guardian");
    }
  }

  try {
    if (targetType === "student") {
      const onlyStudent = activeStudents[0];
      if (onlyStudent) {
        const { data: changed, error } = await admin
          .from("account_students")
          .update({
            relationship: "self",
            alias: null,
            is_primary: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", onlyStudent.id)
          .eq("owner_user_id", user.id)
          .eq("active", true)
          .eq("relationship", onlyStudent.relationship)
          .select("id")
          .maybeSingle();

        if (error || !changed?.id) throw error || new Error("ACCOUNT_STUDENT_STATE_CHANGED");
      }
    } else {
      for (const student of activeStudents) {
        const { data: changed, error } = await admin
          .from("account_students")
          .update({
            relationship: "guardian",
            is_primary:
              activeStudents.length === 1 ? true : student.is_primary,
            updated_at: new Date().toISOString(),
          })
          .eq("id", student.id)
          .eq("owner_user_id", user.id)
          .eq("active", true)
          .eq("relationship", student.relationship)
          .select("id")
          .maybeSingle();

        if (error || !changed?.id) throw error || new Error("ACCOUNT_STUDENT_STATE_CHANGED");
      }
    }

    // A successful SQL response may still update zero rows. A concurrent
    // change must never be reported as a completed account transition.
    const { data: updatedProfile, error: updateProfileError } = await admin
      .from("profiles")
      .update({ user_type: targetType })
      .eq("id", user.id)
      .eq("user_type", currentType)
      .select("id")
      .maybeSingle();

    if (updateProfileError || !updatedProfile?.id) {
      await restoreStudents();
      throw updateProfileError || new Error("ACCOUNT_TYPE_STATE_CHANGED");
    }

    // Re-read Auth immediately before updating metadata so any unrelated
    // user-metadata edits since preflight are not silently overwritten.
    const { data: freshAuth, error: freshAuthError } =
      await admin.auth.admin.getUserById(user.id);
    if (freshAuthError || !freshAuth?.user || freshAuth.user.id !== existingAuthUser.id) {
      await admin.from("profiles").update({ user_type: currentType })
        .eq("id", user.id).eq("user_type", targetType);
      await restoreStudents();
      throw freshAuthError || new Error("AUTH_RECHECK_UNAVAILABLE");
    }

    // Metadata is display state only, never an authorization source.
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...(freshAuth.user.user_metadata || {}),
          user_type: targetType,
        },
      }
    );

    if (authUpdateError) {
      await admin
        .from("profiles")
        .update({ user_type: currentType })
        .eq("id", user.id)
        .eq("user_type", targetType);
      await restoreStudents();
      throw authUpdateError;
    }

    return NextResponse.json({ userType: targetType }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    // Rollback is best effort across PostgreSQL and Auth; never guarantee
    // a fully preserved previous state unless verified transactionally.
    console.error("account_type_reconciliation_required");
    return jsonError(
      "El cambio no se completó. Revisa tu cuenta antes de reintentarlo.",
      503,
      "account_type_reconciliation_required"
    );
  }
}
