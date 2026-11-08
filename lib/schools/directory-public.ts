import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { validOfficialSchoolCode } from "@/lib/schools/directory-identity";
import { isDemoListing } from "@/lib/seo/demo-listing";

export type PublicDirectorySchool = {
  official_code: string;
  name: string;
  school_type: string;
  category: string;
  address: string | null;
  municipality: string;
  province: string;
  autonomous_community: string;
  postal_code: string;
  seo_indexable: boolean;
  linked_school_id: string | null;
  verified_community: boolean;
  available_material: { id: string; title: string }[];
  can_index: boolean;
};

// Only schools expressly published in the directory may be accessed.
// Never expose the internal linked UUID, school roles or access codes to clients.
export const getPublicDirectorySchool = cache(async (officialCode: string): Promise<PublicDirectorySchool | null> => {
  if (!validOfficialSchoolCode(officialCode)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("school_directory")
    .select("official_code,name,school_type,category,address,municipality,province,autonomous_community,postal_code,seo_indexable,linked_school_id")
    .eq("official_code", officialCode)
    .eq("is_listed", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  let verifiedCommunity = false;
  if (data.linked_school_id) {
    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id")
      .eq("id", data.linked_school_id)
      .eq("is_active", true)
      .eq("is_test", false)
      .maybeSingle();
    // Fail closed for public activation / SEO on a failed verification.
    if (!schoolError && school) verifiedCommunity = true;
  }

  // An affiliated community without any genuine available material produces
  // a thin page. Do not expose it to search engines until real value exists.
  // Read only a small, recent sample; fail closed on DB errors and demo data.
  let availableMaterial: { id: string; title: string }[] = [];
  if (data.seo_indexable && verifiedCommunity && data.linked_school_id) {
    const { data: offers, error: offersError } = await admin
      .from("listings")
      .select("id,title")
      .eq("school_id", data.linked_school_id)
      .eq("status", "available")
      .order("updated_at", { ascending: false })
      .limit(40);

    if (!offersError) {
      availableMaterial = (offers || [])
        .filter((offer) => !isDemoListing(offer))
        .filter((offer) => Boolean(offer.id && offer.title))
        .slice(0, 6)
        .map((offer) => ({ id: offer.id, title: offer.title }));
    }
  }

  return {
    ...data,
    verified_community: verifiedCommunity,
    available_material: availableMaterial,
    can_index: Boolean(data.seo_indexable && verifiedCommunity && availableMaterial.length > 0),
  };
});
