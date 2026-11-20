import { computeFederationKpis } from "@/lib/fanpa/federation-kpis";

/**
 * Internal, pure adapter for federation dashboards. Nothing is exposed until
 * a separate, server-side authorization layer establishes represented IDs.
 * Never trust school IDs from URL parameters as an authorization grant.
 */
type Source = Parameters<typeof computeFederationKpis>[0];
export type FederationReportView = {
  totalSchools: number;
  uniqueUsers: number;
  students: number;
  activeListings: number;
  totalListings: number;
  openDemands: number | null;
  confirmedExchanges: number | null;
  schools: Array<{
    id: string;
    name: string;
    users: number;
    students: number;
    activeListings: number;
    totalListings: number;
    openDemands: number | null;
    confirmedExchanges: number | null;
  }>;
};

const MIN_PRIVATE_COHORT = 5;

export function computeScopedFederationReport(
  data: Source,
  representedSchoolIds: readonly string[],
  selectedSchoolId?: string | null,
): FederationReportView | null {
  const allowed = new Set(representedSchoolIds.filter(id => typeof id === "string" && id.length > 0));
  if (allowed.size === 0) return null;
  // The selected school must belong to this federation; never fall back to
  // another school or an all-schools report for a forged filter.
  if (selectedSchoolId && !allowed.has(selectedSchoolId)) return null;

  const seen = new Set<string>();
  const schools = data.schools.filter(school => {
    if (!allowed.has(school.id) || seen.has(school.id)) return false;
    seen.add(school.id);
    return true;
  });
  if (schools.length === 0 || (selectedSchoolId && !seen.has(selectedSchoolId))) return null;

  // The underlying member resolver needs *all* active student contexts to
  // suppress outdated profiles even when the active student is at another
  // school. Keep those identities server-side; never serialize source rows.
  const raw = computeFederationKpis({ ...data, schools });
  const selected = selectedSchoolId
    ? raw.schools.filter(school => school.id === selectedSchoolId)
    : raw.schools;
  const restricted = selected.some(school => school.users < MIN_PRIVATE_COHORT);
  // Hide sensitive totals too when any represented school has a tiny cohort:
  // a visible total minus the other schools' rows could reveal that school.
  const safe = selected.map(school => ({
    id: school.id,
    name: school.name,
    users: school.users,
    students: school.students,
    activeListings: school.activeListings,
    totalListings: school.totalListings,
    openDemands: school.users < MIN_PRIVATE_COHORT ? null : school.openDemands,
    confirmedExchanges: school.users < MIN_PRIVATE_COHORT ? null : school.confirmedExchanges,
  }));
  const uniqueUsers = selectedSchoolId ? selected[0].users : raw.uniqueUsers;
  return {
    totalSchools: selected.length,
    uniqueUsers,
    students: selected.reduce((total, school) => total + school.students, 0),
    activeListings: selected.reduce((total, school) => total + school.activeListings, 0),
    totalListings: selected.reduce((total, school) => total + school.totalListings, 0),
    openDemands: restricted ? null : selected.reduce((total, school) => total + school.openDemands, 0),
    confirmedExchanges: restricted ? null : selected.reduce((total, school) => total + school.confirmedExchanges, 0),
    schools: safe,
  };
}
