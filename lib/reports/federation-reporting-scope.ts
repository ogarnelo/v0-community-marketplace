/**
 * Federation reporting authorization core. NO live federation role/table exists yet.
 * The caller MUST obtain the memberships/representations from a trusted backend,
 * not from client input. This module never authorizes mutations or raw PII.
 */
export type Representation = {
  federationId: string;
  schoolId: string;
  state: "active" | "pending" | "revoked";
  startsAt: string;
  endsAt: string | null;
};
export type ReportingMembership = {
  userId: string;
  federationId: string;
  role: "report_viewer" | "operator";
  state: "active" | "revoked";
};
export type ReportingScopeInput = {
  subjectUserId: string;
  federationId: string;
  memberships: readonly ReportingMembership[];
  representations: readonly Representation[];
  now: Date;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(id: unknown): id is string {
  return typeof id === "string" && UUID.test(id);
}
function parseInstant(value: string | null): number | null {
  if (value === null) return null;
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}
/**
 * Reject all malformed/unknown/inactive authority. No fallback by region,
 * association name, email domain, or super_admin school role.
 */
export function resolveFederationSchoolScope(input: ReportingScopeInput): readonly string[] {
  const {subjectUserId,federationId,memberships,representations,now} = input;
  if (!isUuid(subjectUserId) || !isUuid(federationId) || !(now instanceof Date) ||
      !Number.isFinite(now.getTime()) || !Array.isArray(memberships) ||
      !Array.isArray(representations)) return [];
  // A stale active copy must never override an explicit revocation or a
  // contradictory duplicate. Unique memberships are required for authority.
  const relevant = memberships.filter(m => m.userId === subjectUserId &&
      m.federationId === federationId);
  if (relevant.length !== 1 || relevant[0].role !== "report_viewer" ||
      relevant[0].state !== "active") return [];

  const schools = new Set<string>();
  // A revoked representation for the same federation/school must not be
  // overridden by a second active row (e.g. a stale flattened AMPA mapping).
  // Consistently active duplicate rows still represent one school.
  const representationStates = new Map<string, Set<string>>();
  for (const row of representations) {
    if (row.federationId !== federationId) continue;
    if (!isUuid(row.schoolId)) return [];
    const key = row.schoolId.toLowerCase();
    const states = representationStates.get(key) ?? new Set<string>();
    states.add(row.state);
    representationStates.set(key, states);
  }
  if ([...representationStates.values()].some(states => states.size !== 1)) return [];

  for (const row of representations) {
    if (row.federationId !== federationId || row.state !== "active") continue;
    const start = parseInstant(row.startsAt);
    const end = parseInstant(row.endsAt);
    if (start === null || start > now.getTime() ||
        (row.endsAt !== null && (end === null || end <= now.getTime()))) continue;
    schools.add(row.schoolId.toLowerCase());
  }
  return [...schools].sort();
}
export function requireRepresentedSchool(
  allowedSchoolIds: readonly string[], requestedSchoolId: string
): string {
  if (!isUuid(requestedSchoolId) ||
      !allowedSchoolIds.includes(requestedSchoolId.toLowerCase())) {
    throw new Error("FEDERATION_REPORT_SCOPE_DENIED");
  }
  return requestedSchoolId.toLowerCase();
}
