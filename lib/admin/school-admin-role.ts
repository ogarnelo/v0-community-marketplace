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
    .select("id")
    .eq("id", params.schoolId)
    .maybeSingle();

  if (schoolError) throw schoolError;
  if (!school) throw new Error("El centro indicado no existe.");

  const { data: existingRole, error: roleLookupError } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", params.userId)
    .eq("role", "school_admin")
    .eq("school_id", params.schoolId)
    .maybeSingle();

  if (roleLookupError) throw roleLookupError;

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

  const { error: profileError } = await admin
    .from("profiles")
    .update({ school_id: params.schoolId })
    .eq("id", params.userId);

  if (profileError) throw profileError;
}
