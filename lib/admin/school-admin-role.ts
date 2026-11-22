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

  // Dormant until the reviewed SECURITY INVOKER RPC has been separately
  // installed and enabled. Do not fall back to two independent writes
  // when the atomic mode is ON but the database rejects the call.
  // The global switch alone must never activate a production rollout.
  // Explicitly allowlist the target Auth UUID for an isolated canary.
  // Unknown values, malformed IDs and an empty allowlist stay on legacy.
  const canaryIds = (process.env.WETUDY_R2_SCHOOL_ADMIN_ATOMIC_GRANT_CANARY_USER_IDS || "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id));
  const useAtomicGrant =
    process.env.WETUDY_R2_SCHOOL_ADMIN_ATOMIC_GRANT_ENABLED === "true" &&
    canaryIds.includes(params.userId.toLowerCase());
  if (useAtomicGrant) {
    const { data: committed, error: atomicError } = await admin.rpc(
      "r2_grant_school_admin_atomic_candidate",
      { p_user_id: params.userId, p_school_id: params.schoolId }
    );
    if (atomicError) {
      throw new Error("La concesión del permiso no pudo completarse de forma segura.");
    }
    if (committed !== true) {
      throw new Error("No se pudo autorizar el colegio o confirmar el perfil.");
    }
    return;
  }

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("id, is_active")
    .eq("id", params.schoolId)
    .maybeSingle();

  if (schoolError) throw schoolError;
  if (!school) throw new Error("El centro indicado no existe.");
  if (school.is_active !== true) throw new Error("No se pueden conceder permisos a un centro desactivado.");

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

  // A role must never be inserted for an absent or unreadable profile.
  // This read is intentionally before the privileged role mutation.
  const { data: profileBeforeGrant, error: profileLookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", params.userId)
    .maybeSingle();
  if (profileLookupError || !profileBeforeGrant?.id) {
    throw new Error("No se pudo confirmar el perfil. No se ha iniciado la concesión del rol.");
  }

  if (!existingRole) {
    const { error: roleInsertError } = await admin.from("user_roles").insert({
      user_id: params.userId,
      role: "school_admin",
      school_id: params.schoolId,
    });

    if (roleInsertError?.code === "23505") {
      // A 23505 might mean the SAME school role won a race, or a DIFFERENT
      // school won a global unique index race. Do not rewrite profiles.school_id
      // without confirming the exact role we intended to grant.
      const { data: confirmedRole, error: confirmError } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", params.userId)
        .eq("role", "school_admin")
        .eq("school_id", params.schoolId)
        .maybeSingle();
      if (confirmError || !confirmedRole?.id) {
        throw new Error("No se pudo confirmar el permiso del centro. Revisa los roles antes de reintentar.");
      }
    } else if (roleInsertError) {
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
