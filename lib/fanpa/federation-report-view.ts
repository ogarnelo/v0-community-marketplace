import { computeFederationKpis } from "@/lib/fanpa/federation-kpis";

/**
 * Internal, pure adapter for federation dashboards. Nothing is exposed until
 * a separate, server-side authorization layer establishes represented IDs.
 * Never trust school IDs from URL parameters as an authorization grant.
 */
type Source = Parameters<typeof computeFederationKpis>[0];
export type FederationReportView = {
  totalSchools: number;
  uniqueUsers: number | null;
  students: number | null;
  activeListings: number | null;
  totalListings: number | null;
  openDemands: number | null;
  confirmedExchanges: number | null;
  schools: Array<{
    id: string;
    name: string;
    users: number | null;
    students: number | null;
    activeListings: number | null;
    totalListings: number | null;
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
  // Every small-cohort count can identify families, including listings,
  // students and user totals. Hide all numbers in the small-school rows.
  // Hide EVERY federation aggregate if any represented school is small,
  // preventing a total minus the other school filters from exposing it.
  const safe = selected.map(school => {
    const hide = school.users < MIN_PRIVATE_COHORT;
    return {
      id: school.id,
      name: school.name,
      users: hide ? null : school.users,
      students: hide ? null : school.students,
      activeListings: hide ? null : school.activeListings,
      totalListings: hide ? null : school.totalListings,
      openDemands: hide ? null : school.openDemands,
      confirmedExchanges: hide ? null : school.confirmedExchanges,
    };
  });
  return {
    totalSchools: selected.length,
    uniqueUsers: restricted ? null : (selectedSchoolId ? selected[0].users : raw.uniqueUsers),
    students: restricted ? null :
      selected.reduce((total, school) => total + school.students, 0),
    activeListings: restricted ? null :
      selected.reduce((total, school) => total + school.activeListings, 0),
    totalListings: restricted ? null :
      selected.reduce((total, school) => total + school.totalListings, 0),
    openDemands: restricted ? null :
      selected.reduce((total, school) => total + school.openDemands, 0),
    confirmedExchanges: restricted ? null :
      selected.reduce((total, school) => total + school.confirmedExchanges, 0),
    schools: safe,
  };
}
