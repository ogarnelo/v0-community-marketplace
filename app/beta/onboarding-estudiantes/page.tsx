import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { gradeLevels } from "@/lib/mock-data";
import { buildFullName, normalizeNamePart, splitLegacyFullName } from "@/lib/users/person-name";
import RealStudentOnboardingPreview from "@/components/account-students/real-onboarding-preview";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Onboarding estudiantes Preview | Wetudy",
  robots: { index: false, follow: false },
};

type SafeMetadata = {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  user_type?: string;
  postal_code?: string;
};

export default async function RealStudentOnboardingPreviewPage() {
  if (process.env.VERCEL_ENV !== "preview") notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/api/beta/preview-login?next=/beta/onboarding-estudiantes");
  }

  const metadata = (user.user_metadata || {}) as SafeMetadata;

  const [
    { data: profile, error: profileError },
    { data: schools, error: schoolsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, full_name, user_type, postal_code")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("schools")
      .select("id, name, city")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(500),
  ]);

  if (profileError) console.error("Preview onboarding: error cargando perfil", profileError);
  if (schoolsError) console.error("Preview onboarding: error cargando centros", schoolsError);

  const userType = profile?.user_type || metadata.user_type || null;
  if (userType !== "student" && userType !== "parent") {
    notFound();
  }

  const legacy = splitLegacyFullName(profile?.full_name || metadata.full_name || null);
  const firstName = normalizeNamePart(profile?.first_name || metadata.first_name || legacy.firstName);
  const lastName = normalizeNamePart(profile?.last_name || metadata.last_name || legacy.lastName);

  return (
    <RealStudentOnboardingPreview
      account={{
        firstName,
        lastName,
        email: user.email || "",
        postalCode: profile?.postal_code || metadata.postal_code || "",
        accountType: userType,
      }}
      schools={(schools || []) as Array<{ id: string; name: string; city: string | null }>}
      gradeLevels={Array.from(new Set(gradeLevels)).filter(Boolean)}
    />
  );
}
