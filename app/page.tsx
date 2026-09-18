import type { Metadata } from "next";
import JsonLd from "@/components/seo/json-ld";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { BenefitsFamilies } from "@/components/landing/benefits-families";
import { BenefitsSchools } from "@/components/landing/benefits-schools";
import { ImpactSection } from "@/components/landing/impact-section";
import { CTASection } from "@/components/landing/cta-section";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { SEO_ORGANIZATION_ID, SEO_SITE_URL, SEO_WEBSITE_ID } from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: { absolute: "Wetudy | Reutiliza material escolar entre familias" },
  description: "Compra, vende o dona libros, uniformes y material escolar de segunda mano. Contacta por chat y acuerda entrega y pago directamente entre las partes.",
  alternates: { canonical: `${SEO_SITE_URL}/` },
};

export default async function LandingPage() {
  const supabase = await createClient();

  const navbarProps = await getNavbarData(supabase);

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": SEO_ORGANIZATION_ID,
      name: "Wetudy",
      url: `${SEO_SITE_URL}/`,
      logo: {
        "@type": "ImageObject",
        "@id": `${SEO_SITE_URL}/#logo`,
        url: `${SEO_SITE_URL}/wetudy-icon-512.png`,
        contentUrl: `${SEO_SITE_URL}/wetudy-icon-512.png`,
        width: 512,
        height: 512,
        caption: "Wetudy",
      },
      description: "Comunidad para encontrar, vender, donar y reutilizar material escolar entre familias.",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": SEO_WEBSITE_ID,
      name: "Wetudy",
      alternateName: "Wetudy material escolar",
      url: `${SEO_SITE_URL}/`,
      publisher: { "@id": SEO_ORGANIZATION_ID },
      inLanguage: "es-ES",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd data={structuredData} />
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