import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewListingForm from "@/components/marketplace/new-listing-form";

export const dynamic = "force-dynamic";

type SchoolRecord = {
  id: string;
  name: string;
  city: string | null;
};

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
    .select("school_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Error cargando school_id del perfil:", profileError);
  }

  let selectedSchool: SchoolRecord | null = null;

  if (profile?.school_id && profile.school_id.trim().length > 0) {
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("id, name, city")
      .eq("id", profile.school_id)
      .maybeSingle();

    if (schoolError) {
      console.error("Error cargando school real:", schoolError);
    }

    selectedSchool = (school as SchoolRecord | null) ?? null;
  }

  return (
    <NewListingForm
      initialSchoolId={selectedSchool?.id || ""}
      initialSchoolName={selectedSchool?.name || "Centro no asignado"}
      initialSchoolCity={selectedSchool?.city || ""}
    />
  );
}