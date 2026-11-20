import type { FederationActivityCounts } from "@/lib/fanpa/federation-scoped-activity-reader";

// A final, explicit wire projection: never spread internal service data into
// the federation API. A future reader refactor or untrusted provider response
// must not expose an unrepresented school, personal identifiers, or a total
// that unmasks a small community. Nothing here performs I/O or creates grants.
const MIN_PRIVATE_COHORT = 5;
const FIELDS = [
  "students", "activeListings", "totalListings",
  "openDemands", "confirmedExchanges",
] as const;

type Metric = (typeof FIELDS)[number];
type Counts = Pick<FederationActivityCounts, Metric | "uniqueUsers" | "totalSchools">;

export type SafeFederationKpiResponse = Counts & {
  schools: Array<{
    schoolId: string;
    name: string;
    users: number | null;
    students: number | null;
    activeListings: number | null;
    totalListings: number | null;
    openDemands: number | null;
    confirmedExchanges: number | null;
  }>;
};

function count(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) && value >= 0;
}

function fail(): never {
  throw new Error("fanpa_kpi_projection_unavailable");
}

/**
 * The expected school IDs come only from fresh, server-verified representation,
 * NOT query params. Match the exact set (no extra, duplicate or missing rows).
 * A read error, accidental malformed count or privacy suppression regression
 * must fail the entire response, never return partial data.
 */
export function projectVerifiedFederationKpis(
  raw: FederationActivityCounts,
  expectedSchoolIds: readonly string[],
  authorizedSchools: readonly { id: string; name: string }[],
): SafeFederationKpiResponse {
  if (!Array.isArray(expectedSchoolIds) || expectedSchoolIds.length === 0 ||
      new Set(expectedSchoolIds).size !== expectedSchoolIds.length ||
      !Array.isArray(authorizedSchools) ||
      !raw || typeof raw !== "object" || !Array.isArray(raw.schools) ||
      raw.schools.length !== expectedSchoolIds.length ||
      raw.totalSchools !== expectedSchoolIds.length) fail();

  const allowedNames = new Map<string, string>();
  for (const school of authorizedSchools) {
    if (!school || typeof school.id !== "string" ||
        typeof school.name !== "string" || !school.name.trim() ||
        allowedNames.has(school.id)) fail();
    allowedNames.set(school.id, school.name);
  }

  const expected = new Set(expectedSchoolIds);
  const bySchool = new Map<string, FederationActivityCounts["schools"][number]>();
  for (const school of raw.schools) {
    if (!school || typeof school.schoolId !== "string" ||
        !expected.has(school.schoolId) ||
        !allowedNames.has(school.schoolId) ||
        bySchool.has(school.schoolId)) fail();
    bySchool.set(school.schoolId, school);
  }

  const safeSchools: SafeFederationKpiResponse["schools"] = [];
  let hasSmallCohort = false;
  const sum: Record<Metric, number> = {
    students: 0,
    activeListings: 0,
    totalListings: 0,
    openDemands: 0,
    confirmedExchanges: 0,
  };
  for (const schoolId of expectedSchoolIds) {
    const row = bySchool.get(schoolId);
    const name = allowedNames.get(schoolId);
    if (!row || name === undefined) fail();

    const suppressed = row.users === null;
    if (suppressed) {
      hasSmallCohort = true;
      for (const field of FIELDS) {
        if (row[field] !== null) fail();
      }
    } else {
      // A cohort of 1..4 must NEVER be published numerically.
      if (!count(row.users) || row.users < MIN_PRIVATE_COHORT) fail();
      for (const field of FIELDS) {
        if (!count(row[field])) fail();
        sum[field] += row[field];
        if (!Number.isSafeInteger(sum[field])) fail();
      }
    }

    // No spread: anything else in the reader result (e.g. user_id/email)
    // is dropped even if it was accidentally introduced by a later change.
    safeSchools.push({
      schoolId, name, users: suppressed ? null : row.users,
      students: row.students,
      activeListings: row.activeListings,
      totalListings: row.totalListings,
      openDemands: row.openDemands,
      confirmedExchanges: row.confirmedExchanges,
    });
  }

  for (const field of FIELDS) {
    if (hasSmallCohort) {
      if (raw[field] !== null) fail();
    } else if (!count(raw[field]) || raw[field] !== sum[field]) {
      fail();
    }
  }

  // A family may belong to several schools, therefore no distinct-user
  // federation total can be obtained by adding school member counts.
  const onlySchool = safeSchools.length === 1 ? safeSchools[0] : null;
  if (hasSmallCohort || !onlySchool) {
    if (raw.uniqueUsers !== null) fail();
  } else if (!count(raw.uniqueUsers) ||
             raw.uniqueUsers !== onlySchool.users) {
    fail();
  }

  return {
    totalSchools: safeSchools.length,
    uniqueUsers: raw.uniqueUsers,
    students: raw.students,
    activeListings: raw.activeListings,
    totalListings: raw.totalListings,
    openDemands: raw.openDemands,
    confirmedExchanges: raw.confirmedExchanges,
    schools: safeSchools,
  };
}
