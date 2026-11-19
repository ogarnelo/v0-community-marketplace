import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Do not use user-provided school ids from URL parameters to select whose
// listings to fetch. The route resolves the viewer's stored school itself.
type SchoolScope = { schoolIds: string[]; directoryCodes: string[] };
const OFFICIAL_CODE = /^[A-Za-z0-9_-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveMarketplaceSchoolScope(
  viewerSchoolId: string,
  viewerDirectorySchoolCode: string
): Promise<SchoolScope> {
  const admin = createAdminClient();
  const schoolIds: string[] = [];
  const directoryCodes: string[] = [];
  if (viewerDirectorySchoolCode && OFFICIAL_CODE.test(viewerDirectorySchoolCode)) {
    // National reference is authoritative. Never fall back to an old profile
    // school when a student has explicitly selected a different directory code.
    directoryCodes.push(viewerDirectorySchoolCode);
    const { data, error } = await admin.from("school_directory")
      .select("linked_school_id")
      .eq("official_code", viewerDirectorySchoolCode).maybeSingle();
    if (error) throw error;
    if (data?.linked_school_id && UUID.test(data.linked_school_id)) {
      schoolIds.push(data.linked_school_id);
    }
  } else if (viewerSchoolId && UUID.test(viewerSchoolId)) {
    schoolIds.push(viewerSchoolId);
    const { data, error } = await admin.from("school_directory")
      .select("official_code").eq("linked_school_id", viewerSchoolId).limit(50);
    if (error) throw error;
    for (const row of data || []) {
      if (row.official_code && OFFICIAL_CODE.test(row.official_code)) {
        directoryCodes.push(row.official_code);
      }
    }
  }
  return { schoolIds, directoryCodes };
}

export function makeMarketplaceSchoolFilter(scope: SchoolScope): string | null {
  const clauses = [
    ...scope.schoolIds.map((id) => `school_id.eq.${id}`),
    scope.directoryCodes.length
      ? `directory_school_code.in.(${scope.directoryCodes.join(",")})`
      : "",
  ].filter(Boolean);
  return clauses.length ? clauses.join(",") : null;
}


/**
 * Union of currently authenticated family student contexts, never school IDs
 * provided by request search parameters. Hard cap avoids unbounded privileged
 * directory lookups and accidental broad queries on malformed records.
 */
export async function resolveMarketplaceMultiSchoolScope(
  contexts: Array<{ schoolId: string | null; directorySchoolCode: string | null }>
): Promise<SchoolScope> {
  if (contexts.length > 100) throw new Error("MULTISCHOOL_SCOPE_TOO_LARGE");
  const uniqueContexts = new Map<string, { schoolId: string; directorySchoolCode: string }>();
  for (const context of contexts) {
    const schoolId = context.schoolId?.trim() || "";
    const directorySchoolCode = context.directorySchoolCode?.trim() || "";
    // Contradictory or malformed context must fail closed; no silent fallback.
    if ((schoolId && directorySchoolCode) ||
        (schoolId && !UUID.test(schoolId)) ||
        (directorySchoolCode && !OFFICIAL_CODE.test(directorySchoolCode))) {
      throw new Error("MULTISCHOOL_CONTEXT_INVALID");
    }
    if (schoolId || directorySchoolCode) {
      uniqueContexts.set(`${schoolId}:${directorySchoolCode}`, { schoolId, directorySchoolCode });
    }
  }
  const directSchoolIds = new Set<string>();
  const directCodes = new Set<string>();
  for (const ctx of uniqueContexts.values()) {
    if (ctx.schoolId) directSchoolIds.add(ctx.schoolId.toLowerCase());
    if (ctx.directorySchoolCode) directCodes.add(ctx.directorySchoolCode);
  }
  if (directSchoolIds.size === 0 && directCodes.size === 0) {
    return { schoolIds: [], directoryCodes: [] };
  }

  // Only TWO bounded directory queries regardless of the number of children.
  // Never silently accept the first Supabase max-row page as a full result.
  const admin = createAdminClient();
  const directCodeArray = [...directCodes];
  const schoolIdArray = [...directSchoolIds];
  const [linkedForCodes, codesForSchools] = await Promise.all([
    directCodeArray.length
      ? admin.from("school_directory")
        .select("official_code,linked_school_id")
        .in("official_code", directCodeArray)
        .limit(1000)
      : Promise.resolve({ data: [], error: null }),
    schoolIdArray.length
      ? admin.from("school_directory")
        .select("official_code,linked_school_id")
        .in("linked_school_id", schoolIdArray)
        .limit(1000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (linkedForCodes.error || codesForSchools.error) {
    throw new Error("MULTISCHOOL_DIRECTORY_LOOKUP_FAILED");
  }
  if ((linkedForCodes.data?.length || 0) >= 1000 ||
      (codesForSchools.data?.length || 0) >= 1000) {
    throw new Error("MULTISCHOOL_DIRECTORY_RESULT_LIMIT");
  }
  const schoolIds = new Set(schoolIdArray);
  const directoryCodes = new Set(directCodeArray);
  for (const row of linkedForCodes.data || []) {
    if (directCodes.has(row.official_code) &&
        typeof row.linked_school_id === "string" && UUID.test(row.linked_school_id)) {
      schoolIds.add(row.linked_school_id.toLowerCase());
    }
  }
  for (const row of codesForSchools.data || []) {
    if (typeof row.linked_school_id === "string" &&
        directSchoolIds.has(row.linked_school_id.toLowerCase()) &&
        typeof row.official_code === "string" && OFFICIAL_CODE.test(row.official_code)) {
      directoryCodes.add(row.official_code);
    }
  }
  // Stable filter ordering prevents needless pagination/cache churn.
  return { schoolIds: [...schoolIds].sort(), directoryCodes: [...directoryCodes].sort() };
}
