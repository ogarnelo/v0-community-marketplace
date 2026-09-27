import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeLevels } from "@/lib/mock-data";
import MyCourseBetaClient from "@/components/my-course/my-course-beta-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mi curso Beta | Wetudy",
  robots: { index: false, follow: false },
};

function betaEnabled() {
  return process.env.VERCEL_ENV === "preview" || process.env.WETUDY_MY_COURSE_BETA_ENABLED === "true";
}

export default async function MyCourseBetaPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; isbn?: string; profile_demo?: string }>;
}) {
  if (!betaEnabled()) notFound();

  const params = await searchParams;
  const previewProfileDemo = process.env.VERCEL_ENV === "preview" && params.profile_demo === "1";
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !previewProfileDemo) {
    redirect("/auth?next=/beta/mi-curso");
  }

  const [{ data: schools, error: schoolsError }, { data: listings, error: listingsError }, profileResult] =
    await Promise.all([
      admin
        .from("schools")
        .select("id, name, city")
        .eq("is_active", true)
        .order("name")
        .limit(300),
      admin
        .from("listings")
        .select("id, title, category, grade_level, isbn, school_id, price, original_price, estimated_retail_price, listing_type, type")
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(200),
      user
        ? supabase
            .from("profiles")
            .select("school_id, grade_level")
            .eq("id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (schoolsError) console.error("Mi curso beta: no se pudieron leer los centros", schoolsError);
  if (listingsError) console.error("Mi curso beta: no se pudieron leer los anuncios", listingsError);
  if (profileResult.error) console.error("Mi curso beta: no se pudo leer el perfil", profileResult.error);

  const safeListings = (listings || []).map((listing: any) => ({
    id: listing.id,
    title: listing.title || "Anuncio",
    category: listing.category || null,
    gradeLevel: listing.grade_level || null,
    isbn: listing.isbn || null,
    schoolId: listing.school_id || null,
    price: listing.price ?? null,
    originalPrice: listing.original_price ?? listing.estimated_retail_price ?? null,
    listingType: listing.listing_type || listing.type || null,
  }));

  const profileSchool = profileResult.data?.school_id
    ? (schools || []).find((school: any) => school.id === profileResult.data?.school_id) || null
    : null;

  const demoSchool = previewProfileDemo ? (schools || [])[0] || null : null;
  const demoGrade = gradeLevels.includes("2º ESO") ? "2º ESO" : gradeLevels[0] || null;

  const profileContext =
    user && profileResult.data?.school_id && profileResult.data?.grade_level
      ? {
          isLoggedIn: true,
          isDemoProfile: false,
          schoolId: profileResult.data.school_id,
          schoolName: profileSchool?.name || "Mi centro",
          gradeLevel: profileResult.data.grade_level,
          academicYear: "2026/27",
        }
      : previewProfileDemo && demoSchool && demoGrade
        ? {
            isLoggedIn: true,
            isDemoProfile: true,
            schoolId: demoSchool.id,
            schoolName: demoSchool.name,
            gradeLevel: demoGrade,
            academicYear: "2026/27",
          }
        : {
            isLoggedIn: Boolean(user),
            isDemoProfile: false,
            schoolId: null,
            schoolName: null,
            gradeLevel: null,
            academicYear: "2026/27",
          };

  return (
    <MyCourseBetaClient
      schools={(schools || []) as any[]}
      gradeLevels={Array.from(new Set(gradeLevels)).filter(Boolean)}
      listings={safeListings}
      profileContext={profileContext}
      incomingNeed={
        params.add || params.isbn
          ? {
              title: params.add?.trim() || params.isbn?.trim() || "Necesidad",
              isbn: params.isbn?.trim() || "",
            }
          : null
      }
    />
  );
}
