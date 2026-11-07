import { countSchoolStudents, getSchoolMemberIds } from "@/lib/reports/school-membership";

export type SchoolSummaryRow = {
  id: string;
  name: string;
  users: number;
  students: number;
  activeListings: number;
  totalListings: number;
  openDemands: number;
  confirmedExchanges: number;
};

type SchoolRef = { id: string; name: string };
type ProfileRef = { id: string; school_id: string | null };
type StudentRef = { owner_user_id: string; school_id: string | null };
type AdminRef = { user_id: string; school_id: string | null };
type ListingRef = { id: string; school_id: string | null; status: string | null };
type DemandRef = { id: string; school_id: string | null; status: string | null };
type AgreementRef = { id: string; school_id: string | null; status: string | null };

export function computeFederationKpis(data: {
  schools: SchoolRef[];
  profiles: ProfileRef[];
  students: StudentRef[];
  admins: AdminRef[];
  listings: ListingRef[];
  demands: DemandRef[];
  agreements: AgreementRef[];
}) {
  const uniqueMembers = new Set<string>();
  const schoolIds = new Set(data.schools.map((school) => school.id));
  const schools: SchoolSummaryRow[] = data.schools.map((school) => {
    const accounts = getSchoolMemberIds({
      schoolId: school.id,
      profiles: data.profiles,
      activeStudents: data.students,
      schoolAdmins: data.admins
        .filter((admin) => admin.school_id === school.id)
        .map((admin) => ({ user_id: admin.user_id })),
    });
    for (const id of accounts) uniqueMembers.add(id);
    const items = data.listings.filter((listing) => listing.school_id === school.id);
    const schoolDemands = data.demands.filter((demand) => demand.school_id === school.id);
    return {
      id: school.id,
      name: school.name,
      users: accounts.size,
      students: countSchoolStudents(school.id, data.students),
      activeListings: items.filter((item) => item.status === "available" || item.status === "reserved").length,
      totalListings: items.length,
      openDemands: schoolDemands.filter((demand) => demand.status === "open" || demand.status === "matched").length,
      confirmedExchanges: data.agreements.filter((agreement) => agreement.school_id === school.id && agreement.status === "confirmed").length,
    };
  });
  const scopedSchools = schools.filter((school) => schoolIds.has(school.id));
  return {
    totalSchools: scopedSchools.length,
    uniqueUsers: uniqueMembers.size,
    students: scopedSchools.reduce((sum, school) => sum + school.students, 0),
    activeListings: scopedSchools.reduce((sum, school) => sum + school.activeListings, 0),
    totalListings: scopedSchools.reduce((sum, school) => sum + school.totalListings, 0),
    openDemands: scopedSchools.reduce((sum, school) => sum + school.openDemands, 0),
    confirmedExchanges: scopedSchools.reduce((sum, school) => sum + school.confirmedExchanges, 0),
    schools: scopedSchools,
  };
}
