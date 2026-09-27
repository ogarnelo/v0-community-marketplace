import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeLevels } from "@/lib/mock-data";
import MyCourseBetaClient from "@/components/my-course/my-course-beta-client";

export const dynamic = "force-dynamic";\n\nexport const metadata = {\n  title: "Mi curso Beta | Wetudy",\n  robots: { index: false, follow: false },\n};

function betaEnabled() {
  return process.env.VERCEL_ENV === "preview" || process.env.WETUDY_MY_COURSE_BETA_ENABLED === "true";
}

export default async function MyCourseBetaPage() {
  if (!betaEnabled()) notFound();

  const admin = createAdminClient();

  const [{ data: schools, error: schoolsError }, { data: listings, error: listingsError }] = await Promise.all([
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
  ]);

  if (schoolsError) console.error("Mi curso beta: no se pudieron leer los centros", schoolsError);
  if (listingsError) console.error("Mi curso beta: no se pudieron leer los anuncios", listingsError);

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

  return (
    <MyCourseBetaClient
      schools={(schools || []) as any[]}
      gradeLevels={Array.from(new Set(gradeLevels)).filter(Boolean)}
      listings={safeListings}
    />
  );
}
