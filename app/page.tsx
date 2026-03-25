import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { BenefitsFamilies } from "@/components/landing/benefits-families";
import { BenefitsSchools } from "@/components/landing/benefits-schools";
import { ImpactSection } from "@/components/landing/impact-section";
import { CTASection } from "@/components/landing/cta-section";
import { createClient } from "@/lib/supabase/server";

type SafeUserMetadata = {
  full_name?: string;
};

export default async function LandingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let navbarProps: {
    isLoggedIn?: boolean;
    userName?: string;
    isAdmin?: boolean;
    unreadMessagesCount?: number;
    currentUserId?: string;
  } = {};

  if (user) {
    const metadata = (user.user_metadata || {}) as SafeUserMetadata;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null }>();

    const fullName =
      (typeof profile?.full_name === "string" && profile.full_name.trim().length > 0
        ? profile.full_name.trim()
        : null) ||
      (typeof metadata.full_name === "string" && metadata.full_name.trim().length > 0
        ? metadata.full_name.trim()
        : null) ||
      user.email ||
      "Mi cuenta";

    navbarProps = {
      isLoggedIn: true,
      userName: fullName,
      unreadMessagesCount: 0,
      currentUserId: user.id,
    };
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar {...navbarProps} />
      <main className="flex-1">
        <HeroSection />
        <HowItWorks />
        <BenefitsFamilies />
        <BenefitsSchools />
        <ImpactSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}