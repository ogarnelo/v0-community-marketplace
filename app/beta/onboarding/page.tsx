import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeLevels } from "@/lib/mock-data";
import OnboardingBetaClient from "@/components/my-course/onboarding-beta-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Onboarding Beta | Wetudy",
  robots: { index: false, follow: false },
};

export default async function OnboardingBetaPage() {
  if (process.env.VERCEL_ENV !== "preview") notFound();

  const admin = createAdminClient();
  const { data: schools, error } = await admin
    .from("schools")
    .select("id, name, city")
    .eq("is_active", true)
    .order("name")
    .limit(300);

  if (error) console.error("Onboarding beta: no se pudieron leer los centros", error);

  return (
    <OnboardingBetaClient
      schools={(schools || []) as any[]}
      gradeLevels={Array.from(new Set(gradeLevels)).filter(Boolean)}
    />
  );
}
