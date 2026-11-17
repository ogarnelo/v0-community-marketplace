import { createAdminClient } from "@/lib/supabase/admin";

export async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

    if (error) throw error;

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail
    );

    if (match) return match;
    if (data.users.length < perPage) return null;
  }

  return null;
}

export async function grantSchoolAdminRole(params: {
  userId: string;
  schoolId: string;
}) {
  const admin = createAdminClient();

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("id, is_active")
    .eq("id", params.schoolId)
    .maybeSingle();

  if (schoolError) throw schoolError;
  if (!school) throw new Error("El centro indicado no existe.");
  if (school.is_active === false) throw new Error("No se pueden conceder permisos a un centro desactivado.");

  const { data: existingRole, error: roleLookupError } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", params.userId)
    .eq("role", "school_admin")
    .eq("school_id", params.schoolId)
    .maybeSingle();

  if (roleLookupError) throw roleLookupError;

  // The current school admin dashboard resolves one school per account.
  // Reject a second, conflicting school role rather than silently changing
  // profiles.school_id and leaving authorization ambiguous.
  const { data: otherRoles, error: otherRolesError } = await admin
    .from("user_roles")
    .select("school_id")
    .eq("user_id", params.userId)
    .eq("role", "school_admin")
    .neq("school_id", params.schoolId)
    .limit(1);
  if (otherRolesError) throw otherRolesError;
  if (otherRoles && otherRoles.length > 0) {
    throw new Error("El usuario ya administra otro centro. Revisa sus permisos antes de asignarle uno nuevo.");
  }

  if (!existingRole) {
    const { error: roleInsertError } = await admin.from("user_roles").insert({
      user_id: params.userId,
      role: "school_admin",
      school_id: params.schoolId,
    });

    if (roleInsertError && roleInsertError.code !== "23505") {
      throw roleInsertError;
    }
  }

  // A successful HTTP/SQL response can still affect zero profiles. If a role
  // was inserted before this point, never report the operation as fully done:
  // a missing profile needs administrator reconciliation, not silent success.
  const { data: updatedProfile, error: profileError } = await admin
    .from("profiles")
    .update({ school_id: params.schoolId })
    .eq("id", params.userId)
    .select("id")
    .maybeSingle();

  if (profileError || !updatedProfile?.id) {
    throw new Error("No se pudo confirmar el perfil. Revisa la asignación antes de reintentar.");
  }
}
