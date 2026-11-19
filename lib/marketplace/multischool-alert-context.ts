/**
 * Legacy saved_searches persists a SINGLE school_id/directory_school_code.
 * Never silently collapse several active schools to the first one for a
 * "Solo mi comunidad" alert. This helper is intentionally pure and private to
 * the server workflow; it creates NO new subscription or notification.
 */
export type AlertSchoolContext = {
  school_id?: string | null;
  directory_school_code?: string | null;
};

const SCHOOL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIRECTORY_CODE = /^[A-Za-z0-9_-]{1,64}$/;

export function resolveSingleCommunityAlertContext(
  activeStudents: AlertSchoolContext[],
  fallback: AlertSchoolContext | null,
): { schoolId: string | null; directoryCode: string | null; ambiguous: boolean } {
  if (!Array.isArray(activeStudents) || activeStudents.length > 100) {
    throw new Error("MULTISCHOOL_ALERT_STUDENT_CONTEXT_LIMIT");
  }
  const contexts = activeStudents.length > 0 ? activeStudents : fallback ? [fallback] : [];
  const unique = new Map<string, { schoolId: string | null; directoryCode: string | null }>();
  for (const ctx of contexts) {
    const schoolId = ctx.school_id?.trim() || null;
    const directoryCode = ctx.directory_school_code?.trim() || null;
    if ((schoolId && directoryCode) || (schoolId && !SCHOOL_ID.test(schoolId)) ||
        (directoryCode && !DIRECTORY_CODE.test(directoryCode))) {
      throw new Error("MULTISCHOOL_ALERT_CONTEXT_INVALID");
    }
    // An active student with no school never falls back to a stale profile.
    if (!schoolId && !directoryCode) continue;
    const key = schoolId ? `school:${schoolId.toLowerCase()}` : `directory:${directoryCode}`;
    unique.set(key, { schoolId, directoryCode });
  }
  if (unique.size > 1) return { schoolId: null, directoryCode: null, ambiguous: true };
  const only = unique.values().next().value;
  return { schoolId: only?.schoolId || null, directoryCode: only?.directoryCode || null, ambiguous: false };
}
