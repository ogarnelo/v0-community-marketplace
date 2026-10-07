import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { categories } from "@/lib/mock-data";
import MyCourseClient from "@/components/my-course/my-course-client";
import { Navbar } from "@/components/navbar";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { listCourseNeeds } from "@/lib/my-course/course-needs-server";
import { listFulfilledCourseNeeds } from "@/lib/my-course/course-need-history-server";
import { getCourseNeedSearchStates } from "@/lib/my-course/course-need-search-server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mi curso | Wetudy",
  robots: { index: false, follow: false },
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
};

type SchoolRow = {
  id: string;
  name: string;
  city: string | null;
  is_test: boolean | null;
};

export default async function MyCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string | string[]; isbn?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/mi-curso");
  }

  const navbarData = await getNavbarData(supabase);

  if (navbarData.isSchoolAdmin && navbarData.adminHref === "/admin/school") {
    redirect("/admin/school");
  }

  const params = await searchParams;
  const incomingTitle =
    typeof params.add === "string" ? params.add.trim().slice(0, 180) : "";
  const incomingIsbn =
    typeof params.isbn === "string" ? params.isbn.trim().slice(0, 32) : "";

  const [
    { data: profile, error: profileError },
    { data: students, error: studentsError },
    { data: schools, error: schoolsError },
    { data: listings, error: listingsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("account_students")
      .select(
        "id, relationship, alias, school_id, grade_level, academic_year, is_primary, active, sort_order, created_at"
      )
      .eq("owner_user_id", user.id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("schools")
      .select("id, name, city, is_test")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(500),
    supabase
      .from("listings")
      .select(
        "id, title, category, grade_level, isbn, school_id, price, original_price, estimated_retail_price, listing_type, type"
      )
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (profileError) console.error("Mi curso: error cargando perfil", profileError);
  if (studentsError) console.error("Mi curso: error cargando estudiantes", studentsError);
  if (schoolsError) console.error("Mi curso: error cargando centros", schoolsError);
  if (listingsError) console.error("Mi curso: error cargando anuncios", listingsError);

  const userType = profile?.user_type;
  if (userType !== "parent" && userType !== "student") {
    redirect("/account");
  }

  const studentRows = ((students || []) as StudentRow[]).filter((student) =>
    userType === "student" ? student.relationship === "self" : student.relationship === "guardian"
  );

  if (studentRows.length === 0) {
    redirect("/onboarding/students?next=/mi-curso");
  }

  const linkedSchoolIds = new Set(
    studentRows
      .map((student) => student.school_id)
      .filter((value): value is string => Boolean(value))
  );
  const schoolById = new Map(
    ((schools || []) as SchoolRow[])
      .filter((school) => !school.is_test || linkedSchoolIds.has(school.id))
      .map((school) => [school.id, school])
  );

  const courseStudents = studentRows.map((student, index) => {
    const school = student.school_id ? schoolById.get(student.school_id) || null : null;

    return {
      id: student.id,
      label:
        userType === "student"
          ? "Mi curso"
          : student.alias?.trim() || "Estudiante " + (index + 1),
      schoolId: student.school_id,
      schoolName: school?.name || null,
      schoolCity: school?.city || null,
      gradeLevel: student.grade_level,
      academicYear: student.academic_year,
      isPrimary: student.is_primary,
    };
  });

  let persistedNeeds = [] as Awaited<ReturnType<typeof listCourseNeeds>>;

  try {
    persistedNeeds = await listCourseNeeds(user.id);
  } catch (error) {
    console.error("Mi curso: error cargando necesidades persistentes", error);
  }

  let fulfilledCourseNeeds = [] as Awaited<
    ReturnType<typeof listFulfilledCourseNeeds>
  >;

  try {
    fulfilledCourseNeeds = await listFulfilledCourseNeeds(user.id);
  } catch (error) {
    console.error("Mi curso: error cargando historial de necesidades", error);
  }

  let searchStateByDemandId: Record<string, boolean> = {};

  try {
    searchStateByDemandId = await getCourseNeedSearchStates(
      user.id,
      persistedNeeds.map((need) => need.demand_request_id)
    );
  } catch (error) {
    console.error("Mi curso: error cargando estado de Buscar por mí", error);
  }

  const activeCourseByStudent = new Map(
    courseStudents.map((student) => [student.id, student.academicYear])
  );

  const initialNeeds = persistedNeeds
    .filter(
      (need) =>
        activeCourseByStudent.get(need.student_id) === need.academic_year
    )
    .map((need) => ({
      id: need.id,
      studentId: need.student_id,
      title: need.title,
      isbn: need.isbn || "",
      category: need.category,
      academicYear: need.academic_year,
      demandRequestId: need.demand_request_id,
      searchActive: need.demand_request_id
        ? Boolean(searchStateByDemandId[need.demand_request_id])
        : false,
      createdAt: need.created_at,
    }));

  const fulfilledNeeds = fulfilledCourseNeeds.map((need) => ({
    id: need.id,
    studentId: need.student_id,
    title: need.title,
    isbn: need.isbn || "",
    category: need.category,
    academicYear: need.academic_year,
    fulfilledAt: need.fulfilled_at,
    listingId: need.listing_id,
    listingTitle: need.listing_title,
    listingStatus: need.listing_status,
    agreementId: need.agreement_id,
    agreementType: need.agreement_type,
    agreementAmount: need.agreement_amount,
    agreementConfirmedAt: need.agreement_confirmed_at,
    conversationId: need.conversation_id,
  }));

  const safeListings = (listings || []).map((listing: any) => ({
    id: listing.id,
    title: listing.title || "Anuncio",
    category: listing.category || null,
    gradeLevel: listing.grade_level || null,
    isbn: listing.isbn || null,
    schoolId: listing.school_id || null,
    price: typeof listing.price === "number" ? listing.price : listing.price == null ? null : Number(listing.price),
    originalPrice:
      listing.original_price != null
        ? Number(listing.original_price)
        : listing.estimated_retail_price != null
          ? Number(listing.estimated_retail_price)
          : null,
    listingType: listing.listing_type || listing.type || null,
  }));

  return (
    <>
      <Navbar {...navbarData} />
      <MyCourseClient
      accountType={userType}
      students={courseStudents}
      categories={Array.from(new Set(categories)).filter(Boolean)}
      listings={safeListings}
      initialNeeds={initialNeeds}
      fulfilledNeeds={fulfilledNeeds}
      legacyStorageKey={`wetudy_my_course_v1:${user.id}`}
      incomingNeed={
        incomingTitle || incomingIsbn
          ? {
              title: incomingTitle || incomingIsbn,
              isbn: incomingIsbn,
            }
          : null
      }
      />
    </>
  );
}
