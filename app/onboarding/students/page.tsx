import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeInternalPath } from "@/lib/auth/safe-next";
import { gradeLevels } from "@/lib/mock-data";
import { buildFullName, normalizeNamePart, splitLegacyFullName } from "@/lib/users/person-name";
import AccountStudentsOnboarding from "@/components/onboarding/account-students-onboarding";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Configura tus estudiantes | Wetudy",
  robots: { index: false, follow: false },
};

type SafeMetadata = {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  user_type?: string;
};

type StudentRow = {
  id: string;
  relationship: "self" | "guardian";
  alias: string | null;
  school_id: string | null;
  grade_level: string;
  academic_year: string;
  is_primary: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export default async function StudentsOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/onboarding/students");
  }

  const requested = await searchParams;
  const requestedNext =
    typeof requested.next === "string" ? requested.next : null;
  const safeNext = getSafeInternalPath(requestedNext);

  const { data: schoolAdminRole, error: schoolAdminRoleError } = await supabase
    .from("user_roles")
    .select("school_id")
    .eq("user_id", user.id)
    .eq("role", "school_admin")
    .not("school_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (schoolAdminRoleError) {
    console.error("Onboarding estudiantes: error comprobando rol de centro", schoolAdminRoleError);
  }

  if (schoolAdminRole?.school_id) {
    redirect("/admin/school");
  }

  const metadata = (user.user_metadata || {}) as SafeMetadata;

  const [
    { data: profile, error: profileError },
    { data: schools, error: schoolsError },
    { data: students, error: studentsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, full_name, user_type")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("schools")
      .select("id, name, city, postal_code, is_test")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(500),
    supabase
      .from("account_students")
      .select("id, relationship, alias, school_id, grade_level, academic_year, is_primary, active, sort_order, created_at, updated_at")
      .eq("owner_user_id", user.id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (profileError) console.error("Onboarding estudiantes: error cargando perfil", profileError);
  if (schoolsError) console.error("Onboarding estudiantes: error cargando centros", schoolsError);
  if (studentsError) console.error("Onboarding estudiantes: error cargando estudiantes", studentsError);

  const userType = profile?.user_type || metadata.user_type || null;
  const linkedSchoolIds = new Set(
    ((students || []) as StudentRow[])
      .map((student) => student.school_id)
      .filter((value): value is string => Boolean(value))
  );
  const visibleSchools = ((schools || []) as Array<{
    id: string;
    name: string;
    city: string | null;
    postal_code: string | null;
    is_test: boolean | null;
  }>).filter((school) => !school.is_test || linkedSchoolIds.has(school.id));

  if (userType === "business") {
    redirect("/account");
  }

  if (userType !== "parent" && userType !== "student") {
    redirect("/account");
  }

  const legacy = splitLegacyFullName(profile?.full_name || metadata.full_name || null);
  const firstName = normalizeNamePart(
    profile?.first_name || metadata.first_name || legacy.firstName
  );
  const lastName = normalizeNamePart(
    profile?.last_name || metadata.last_name || legacy.lastName
  );

  return (
    <AccountStudentsOnboarding
      accountType={userType}
      accountHolderName={buildFullName(firstName, lastName)}
      initialStudents={(students || []) as StudentRow[]}
      schools={visibleSchools.map(({ is_test: _isTest, ...school }) => school)}
      gradeLevels={Array.from(new Set(gradeLevels)).filter(Boolean)}
      nextPath={safeNext}
    />
  );
}
