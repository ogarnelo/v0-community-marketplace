/** Private server-read projection: a school_admin grant may target at most one
 * school. Never silently take LIMIT 1 from two contradictory grants.
 * Family multi-student school selection is a separate, unprivileged concern.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function resolveUniqueSchoolAdminSchoolId(
  rows: unknown,
): string | null {
  if (!Array.isArray(rows) || rows.length > 2) throw Error("INVALID_SCHOOL_ADMIN_CONTEXT");
  if (rows.length === 0) return null;
  if (rows.length !== 1 || !rows[0] ||
      typeof rows[0].school_id !== "string" ||
      !UUID.test(rows[0].school_id)) throw Error("AMBIGUOUS_SCHOOL_ADMIN_CONTEXT");
  return rows[0].school_id.toLowerCase();
}
