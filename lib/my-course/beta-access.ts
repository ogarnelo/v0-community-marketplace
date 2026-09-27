import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const MY_COURSE_FEATURE_KEY = "my_course_beta";

export function isMyCourseBetaGloballyEnabled() {
  return process.env.WETUDY_MY_COURSE_BETA_ENABLED === "true";
}

export async function canUseMyCourseBeta({
  userId,
  schoolIds = [],
}: {
  userId: string;
  schoolIds?: Array<string | null | undefined>;
}) {
  if (!isMyCourseBetaGloballyEnabled()) return false;

  const admin = createAdminClient();

  const { data: superAdminRole } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();

  if (superAdminRole?.role === "super_admin") return true;

  const { data: userAccess } = await admin
    .from("product_feature_access")
    .select("id")
    .eq("feature_key", MY_COURSE_FEATURE_KEY)
    .eq("user_id", userId)
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();

  if (userAccess?.id) return true;

  const normalizedSchoolIds = Array.from(
    new Set(schoolIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0))
  );

  if (normalizedSchoolIds.length === 0) return false;

  const { data: schoolAccess } = await admin
    .from("product_feature_access")
    .select("id")
    .eq("feature_key", MY_COURSE_FEATURE_KEY)
    .eq("enabled", true)
    .in("school_id", normalizedSchoolIds)
    .limit(1);

  return Boolean(schoolAccess?.length);
}
