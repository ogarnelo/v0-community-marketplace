export type AdminRoleName = "super_admin" | "school_admin";

export type AdminRoleRow = {
  role: AdminRoleName | string;
  school_id: string | null;
};

export function getAdminFlags({
  roles,
}: {
  email?: string | null;
  roles?: AdminRoleRow[] | null;
}) {
  const safeRoles = Array.isArray(roles) ? roles : [];
  const hasSuperAdminRole = safeRoles.some((role) => role.role === "super_admin");
  const schoolAdminRole =
    safeRoles.find(
      (role) =>
        role.role === "school_admin" &&
        typeof role.school_id === "string" &&
        role.school_id.length > 0
    ) || safeRoles.find((role) => role.role === "school_admin") || null;

  const isSuperAdmin = hasSuperAdminRole;
  const isSchoolAdmin = safeRoles.some((role) => role.role === "school_admin");

  return {
    isSuperAdminByEmail: false,
    hasSuperAdminRole,
    isSuperAdmin,
    isSchoolAdmin,
    canAccessAdmin: isSuperAdmin || isSchoolAdmin,
    schoolAdminSchoolId: schoolAdminRole?.school_id || null,
  };
}
