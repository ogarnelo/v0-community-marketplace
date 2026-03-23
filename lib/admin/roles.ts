export const PROVISIONAL_SUPERADMIN_EMAILS = [
  "oscar_garnelo@hotmail.com",
] as const;

export type AdminRoleName = "super_admin" | "school_admin";

export type AdminRoleRow = {
  role: AdminRoleName | string;
  school_id: string | null;
};

export function isProvisionalSuperAdminEmail(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase() || "";
  return PROVISIONAL_SUPERADMIN_EMAILS.includes(
    normalizedEmail as (typeof PROVISIONAL_SUPERADMIN_EMAILS)[number]
  );
}

export function getAdminFlags({
  email,
  roles,
}: {
  email?: string | null;
  roles?: AdminRoleRow[] | null;
}) {
  const safeRoles = Array.isArray(roles) ? roles : [];
  const isSuperAdminByEmail = isProvisionalSuperAdminEmail(email);
  const hasSuperAdminRole = safeRoles.some((role) => role.role === "super_admin");
  const schoolAdminRole =
    safeRoles.find(
      (role) =>
        role.role === "school_admin" &&
        typeof role.school_id === "string" &&
        role.school_id.length > 0
    ) || safeRoles.find((role) => role.role === "school_admin") || null;

  const isSuperAdmin = isSuperAdminByEmail || hasSuperAdminRole;
  const isSchoolAdmin = safeRoles.some((role) => role.role === "school_admin");

  return {
    isSuperAdminByEmail,
    hasSuperAdminRole,
    isSuperAdmin,
    isSchoolAdmin,
    canAccessAdmin: isSuperAdmin || isSchoolAdmin,
    schoolAdminSchoolId: schoolAdminRole?.school_id || null,
  };
}