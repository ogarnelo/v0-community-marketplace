import { createAdminClient } from "@/lib/supabase/admin";

// Internal only. Accept school IDs only from a freshly verified federation
// representation decision, never directly from user-provided query strings.
// No route imports this module while the reporting flag is disabled.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_PRIVATE_COHORT = 5;
const MAX_REPRESENTED_SCHOOLS = 100;

export type SchoolActivityCounts = {
  schoolId: string;
  users: number | null;
  students: number | null;
  activeListings: number | null;
  totalListings: number | null;
  openDemands: number | null;
  confirmedExchanges: number | null;
};

export type FederationActivityCounts = {
  totalSchools: number;
  // A user may belong to several schools: do NOT sum school user counts.
  uniqueUsers: number | null;
  students: number | null;
  activeListings: number | null;
  totalListings: number | null;
  openDemands: number | null;
  confirmedExchanges: number | null;
  schools: SchoolActivityCounts[];
};

function validCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("fanpa_count_unavailable");
  }
  return value;
}

export async function readScopedFederationActivityCounts(
  verifiedRepresentedSchoolIds: readonly string[],
): Promise<FederationActivityCounts> {
  if (!Array.isArray(verifiedRepresentedSchoolIds) ||
      verifiedRepresentedSchoolIds.length === 0 ||
      verifiedRepresentedSchoolIds.length > MAX_REPRESENTED_SCHOOLS ||
      verifiedRepresentedSchoolIds.some(id => typeof id !== "string" || !UUID.test(id)) ||
      new Set(verifiedRepresentedSchoolIds).size !== verifiedRepresentedSchoolIds.length) {
    throw new Error("fanpa_scope_invalid");
  }

  const admin = createAdminClient();
  const schools: SchoolActivityCounts[] = [];
  for (const schoolId of verifiedRepresentedSchoolIds) {
    // The existing server-only RPC does a DISTINCT member count, accounting
    // for active school contexts and old profile.school_id fallbacks. It
    // never returns person IDs or scans every profile into the application.
    const members = await admin.rpc("server_school_member_count", {
      p_school_id: schoolId,
    });
    if (members.error) throw new Error("fanpa_member_count_unavailable");
    const users = validCount(members.data);

    // Do not even query activity for schools with fewer than five members.
    // Returning 0 is also disclosive for tiny communities: return null.
    if (users < MIN_PRIVATE_COHORT) {
      schools.push({
        schoolId, users: null, students: null, activeListings: null,
        totalListings: null, openDemands: null, confirmedExchanges: null,
      });
      continue;
    }

    // These are HEAD-only exact counts, scoped by a verified school ID.
    // No listing, student, demand, or agreement row is transferred.
    const [students, activeListings, totalListings, openDemands, exchanges] =
      await Promise.all([
        admin.from("account_students").select("id", { head: true, count: "exact" })
          .eq("school_id", schoolId).eq("active", true),
        admin.from("listings").select("id", { head: true, count: "exact" })
          .eq("school_id", schoolId).in("status", ["available", "reserved"]),
        admin.from("listings").select("id", { head: true, count: "exact" })
          .eq("school_id", schoolId),
        admin.from("demand_requests").select("id", { head: true, count: "exact" })
          .eq("school_id", schoolId).in("status", ["open", "matched"]),
        admin.from("agreements").select("id", { head: true, count: "exact" })
          .eq("school_id", schoolId).eq("status", "confirmed"),
      ]);
    const counts = [students, activeListings, totalListings, openDemands, exchanges];
    if (counts.some(item => item.error)) throw new Error("fanpa_activity_count_unavailable");
    const [studentCount, activeCount, totalCount, demandCount, exchangeCount] =
      counts.map(item => validCount(item.count));
    schools.push({
      schoolId, users, students: studentCount,
      activeListings: activeCount, totalListings: totalCount,
      openDemands: demandCount, confirmedExchanges: exchangeCount,
    });
  }

  const hasSmallSchool = schools.some(school => school.users === null);
  const total = (key: "students" | "activeListings" | "totalListings" |
      "openDemands" | "confirmedExchanges"): number | null =>
    hasSmallSchool ? null :
      schools.reduce((sum, school) => sum + (school[key] ?? 0), 0);

  return {
    totalSchools: schools.length,
    // Per-school counts are NOT globally distinct when a family has children
    // in several schools. For multiple schools, report no unique-user total
    // until a safe UNION DISTINCT server-only aggregate has been tested.
    uniqueUsers: hasSmallSchool || schools.length > 1 ? null : schools[0].users,
    students: total("students"),
    activeListings: total("activeListings"),
    totalListings: total("totalListings"),
    openDemands: total("openDemands"),
    confirmedExchanges: total("confirmedExchanges"),
    schools,
  };
}
