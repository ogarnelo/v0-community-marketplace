import { createAdminClient } from "@/lib/supabase/admin";

export const SCHOOL_DIRECTORY_BASE_URL = "https://www.wetudy.com";
export const VALID_OFFICIAL_SCHOOL_CODE = /^[0-9]{8}$/;
export type ListedCentre = {
  official_code: string;
  name: string;
  school_type: string;
  category: string;
  municipality: string;
  province: string;
  autonomous_community: string;
  postal_code: string;
  address: string | null;
};

export function directoryPageUrl(code: string): string {
  if (!VALID_OFFICIAL_SCHOOL_CODE.test(code)) throw new Error("invalid_school_code");
  return `${SCHOOL_DIRECTORY_BASE_URL}/centros/${code}`;
}

/**
 * One shared lookup for detail, metadata and QR.
 * Importing a school is never equivalent to editorial publication.
 * No links to operational schools, accounts or membership are returned.
 */
export async function readListedDirectoryCentre(code: string): Promise<ListedCentre | null> {
  if (!VALID_OFFICIAL_SCHOOL_CODE.test(code)) return null;
  const { data, error } = await createAdminClient().from("school_directory")
    .select("official_code,name,school_type,category,municipality,province,autonomous_community,postal_code,address")
    .eq("official_code", code)
    .eq("is_listed", true)
    .maybeSingle<ListedCentre>();
  if (error) throw new Error("directory_lookup_unavailable");
  return data ?? null;
}
