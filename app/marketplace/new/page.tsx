import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewListingForm from "@/components/marketplace/new-listing-form";
import type { ProfileRow, SchoolRow } from "@/lib/types/marketplace";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/marketplace/new");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, user_type, school_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Error cargando school_id del perfil:", profileError);
  }

  const typedProfile = (profile as ProfileRow | null) ?? null;

  let selectedSchool: SchoolRow | null = null;

  if (typedProfile?.school_id && typedProfile.school_id.trim().length > 0) {
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("id, name, city")
      .eq("id", typedProfile.school_id)
      .maybeSingle();

    if (schoolError) {
      console.error("Error cargando school real:", schoolError);
    }

    selectedSchool = (school as SchoolRow | null) ?? null;
  }

  return (
    <NewListingForm
      initialSchoolId={selectedSchool?.id || ""}
      initialSchoolName={selectedSchool?.name || "Centro no asignado"}
      initialSchoolCity={selectedSchool?.city || ""}
    />
  );
}