import type { Metadata } from "next";
import { SEO_SITE_URL } from "@/lib/seo/structured-data";

export function buildPublicMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const canonical = path === "/" ? `${SEO_SITE_URL}/` : `${SEO_SITE_URL}${path}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "Wetudy",
      locale: "es_ES",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
