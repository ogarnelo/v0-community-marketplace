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
