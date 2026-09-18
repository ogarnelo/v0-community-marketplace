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

export const metadata: Metadata = {
  title: { absolute: "Wetudy | Reutiliza material escolar entre familias" },
  description: "Compra, vende o dona libros, uniformes y material escolar de segunda mano. Contacta por chat y acuerda entrega y pago directamente entre las partes.",
  alternates: { canonical: "https://www.wetudy.com/" },
};

export default async function LandingPage() {
  const supabase = await createClient();

  const navbarProps = await getNavbarData(supabase);

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Wetudy",
      url: "https://www.wetudy.com/",
      logo: "https://www.wetudy.com/wetudy-icon-512.png",
      description: "Comunidad para comprar, vender, donar y reutilizar material escolar entre familias.",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Wetudy",
      alternateName: "Wetudy material escolar",
      url: "https://www.wetudy.com/",
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