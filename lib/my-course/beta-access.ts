import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const MY_COURSE_FEATURE_KEY = "my_course_beta";

export type MyCourseBetaAccess = "super_admin" | "user" | "school" | null;

export function isMyCourseBetaGloballyEnabled() {
  return process.env.WETUDY_MY_COURSE_BETA_ENABLED === "true";
}

export async function getMyCourseBetaAccess({
  userId,
  linkedSchoolIds = [],
}: {
  userId: string;
  linkedSchoolIds?: Array<string | null | undefined>;
}): Promise<MyCourseBetaAccess> {
  if (!isMyCourseBetaGloballyEnabled()) return null;

  const admin = createAdminClient();

  const { data: superAdminRole } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();

  if (superAdminRole?.role === "super_admin") return "super_admin";

  const { data: userAccess } = await admin
    .from("product_feature_access")
    .select("id")
    .eq("feature_key", MY_COURSE_FEATURE_KEY)
    .eq("user_id", userId)
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();

  if (userAccess?.id) return "user";

  const normalizedSchoolIds = Array.from(
    new Set(linkedSchoolIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0))
  );

  if (normalizedSchoolIds.length === 0) return null;

  const { data: schoolAccess } = await admin
    .from("product_feature_access")
    .select("id")
    .eq("feature_key", MY_COURSE_FEATURE_KEY)
    .eq("enabled", true)
    .in("school_id", normalizedSchoolIds)
    .limit(1);

  return schoolAccess?.length ? "school" : null;
}

export async function canUseMyCourseBeta(args: {
  userId: string;
  linkedSchoolIds?: Array<string | null | undefined>;
}) {
  return Boolean(await getMyCourseBetaAccess(args));
}
