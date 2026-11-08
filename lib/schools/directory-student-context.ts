import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Codes MUST originate from account_students rows already scoped to the
// authenticated owner by the caller. The map only contains school names.
export async function loadStudentDirectoryNames(codes: Array<string | null>) {
  const selected = Array.from(
    new Set(codes.filter((code): code is string => Boolean(code && /^[0-9]{8}$/.test(code))))
  ).slice(0, 25);
  const directory = new Map<string, { name: string; municipality: string }>();
  if (!selected.length) return directory;

  const { data, error } = await createAdminClient()
    .from("school_directory")
    .select("official_code,name,municipality")
    .in("official_code", selected);

  if (error) {
    console.error("No se pudieron resolver los colegios seleccionados", error);
    return directory;
  }
  for (const school of data || []) {
    directory.set(school.official_code, { name: school.name, municipality: school.municipality });
  }
  return directory;
}
