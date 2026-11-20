import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoListing } from "@/lib/seo/demo-listing";
import { VALID_OFFICIAL_SCHOOL_CODE } from "@/lib/schools/listed-directory-centre";

// An editorial listing is NOT sufficient for search indexing. This feature
// is independently gated and must remain OFF until explicit SEO authorization.
export const DIRECTORY_SEO_FLAG = "WETUDY_DIRECTORY_SEO_ENABLED";
export function isDirectorySeoEnabled(): boolean {
  return process.env.WETUDY_PUBLIC_SCHOOL_DIRECTORY_ENABLED === "true" &&
    process.env.WETUDY_DIRECTORY_SEO_ENABLED === "true";
}

type Candidate = {
  official_code: string;
  is_listed: boolean;
  seo_indexable: boolean;
  linked_school_id: string | null;
};

/**
 * Server-only, fail-closed SEO verification; returns a boolean, not listings.
 * Don't render listings/user data in metadata. Never claim an AMPA is verified.
 */
export async function isDirectoryCentreSeoEligible(code: string): Promise<boolean> {
  if (!isDirectorySeoEnabled() || !VALID_OFFICIAL_SCHOOL_CODE.test(code)) return false;
  try {
    const admin = createAdminClient();
    const { data: centre, error: centreError } = await admin
      .from("school_directory")
      .select("official_code,is_listed,seo_indexable,linked_school_id")
      .eq("official_code", code)
      .eq("is_listed", true)
      .eq("seo_indexable", true)
      .maybeSingle<Candidate>();
    if (centreError || !centre || centre.is_listed !== true ||
        centre.seo_indexable !== true || !centre.linked_school_id) return false;
    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id")
      .eq("id", centre.linked_school_id)
      .eq("is_active", true)
      .eq("is_test", false)
      .maybeSingle();
    if (schoolError || !school) return false;
    const { data: offers, error: offersError } = await admin
      .from("listings")
      .select("id,title")
      .eq("school_id", centre.linked_school_id)
      .eq("status", "available")
      .limit(40);
    if (offersError || !Array.isArray(offers)) return false;
    return offers.some(offer => Boolean(offer.id && offer.title?.trim()) &&
      !isDemoListing(offer));
  } catch {
    return false;
  }
}
