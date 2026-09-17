import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { BenefitsFamilies } from "@/components/landing/benefits-families";
import { BenefitsSchools } from "@/components/landing/benefits-schools";
import { ImpactSection } from "@/components/landing/impact-section";
import { CTASection } from "@/components/landing/cta-section";
import JsonLd from "@/components/seo/json-ld";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import {
  absoluteUrl,
  DEFAULT_OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/seo/site";

export const metadata: Metadata = {
  title: {
    absolute: SITE_TITLE,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    type: "website",
    siteName: SITE_NAME,
    locale: "es_ES",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
};

const homeJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: "Wetudy material escolar",
    url: `${SITE_URL}/`,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/brand/wetudy-logo-512.png"),
      width: 512,
      height: 512,
    },
    description: SITE_DESCRIPTION,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: "Wetudy material escolar",
    url: `${SITE_URL}/`,
    inLanguage: "es-ES",
    publisher: {
      "@id": `${SITE_URL}/#organization`,
    },
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const navbarProps = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd data={homeJsonLd} />
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
