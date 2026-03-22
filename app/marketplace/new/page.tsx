import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { schools } from "@/lib/mock-data";
import NewListingForm from "@/components/marketplace/new-listing-form";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/marketplace/new");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .maybeSingle();

  const selectedSchool =
    profile?.school_id && profile.school_id.trim().length > 0
      ? schools.find((school) => school.id === profile.school_id) || null
      : null;

  return (
    <NewListingForm
      initialSchoolId={selectedSchool?.id || ""}
      initialSchoolName={selectedSchool?.name || "Centro no asignado"}
      initialSchoolCity={selectedSchool?.city || ""}
    />
  );
}
