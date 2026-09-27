import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/server-user";
import { gradeLevels } from "@/lib/mock-data";
import { canUseMyCourseBeta, isMyCourseBetaGloballyEnabled } from "@/lib/my-course/beta-access";
import MyCourseBetaClient from "@/components/my-course/my-course-beta-client";

export const dynamic = "force-dynamic";

export default async function MyCourseBetaPage() {
  if (!isMyCourseBetaGloballyEnabled()) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/auth?next=/beta/mi-curso");

  const supabase = await createClient();

  const [{ data: profile }, { data: schools }] = await Promise.all([
    supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle(),
    supabase.from("schools").select("id, name, city").eq("is_active", true).order("name"),
  ]);

  const allowed = await canUseMyCourseBeta({
    userId: user.id,
    linkedSchoolIds: [profile?.school_id],
  });

  if (!allowed) notFound();

  const [{ data: learners, error: learnersError }, { data: needs, error: needsError }] = await Promise.all([
    supabase
      .from("family_learners")
      .select("id, label, school_id, grade_level, academic_year")
      .eq("parent_user_id", user.id)
      .eq("active", true)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("demand_requests")
      .select("id, learner_id, title, category, isbn, status, matched_listing_id")
      .eq("user_id", user.id)
      .not("learner_id", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  if (learnersError) throw learnersError;
  if (needsError) throw needsError;

  const listingIds = Array.from(
    new Set((needs || []).map((need: any) => need.matched_listing_id).filter(Boolean))
  );

  const { data: listings, error: listingsError } = listingIds.length
    ? await supabase
        .from("listings")
        .select("id, title, price, listing_type, type")
        .in("id", listingIds)
    : { data: [], error: null };

  if (listingsError) throw listingsError;

  const normalizedGradeLevels = Array.from(new Set(gradeLevels)).filter(Boolean);

  return (
    <MyCourseBetaClient
      schools={(schools || []) as any[]}
      gradeLevels={normalizedGradeLevels}
      learners={(learners || []) as any[]}
      needs={(needs || []) as any[]}
      listings={(listings || []) as any[]}
    />
  );
}
