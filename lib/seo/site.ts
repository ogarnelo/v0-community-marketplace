import type { Metadata } from "next";

export const SITE_NAME = "Wetudy";
export const SITE_URL = "https://www.wetudy.com";
export const SITE_TITLE = "Wetudy | Material escolar entre familias";
export const SITE_DESCRIPTION =
  "Encuentra, publica, vende o dona libros, uniformes y material escolar. Contacta por chat y acuerda entrega y pago directamente con otra familia.";
export const DEFAULT_OG_IMAGE = "/og-default.png";

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

export function createPublicMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      locale: "es_ES",
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      url: path,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [image],
    },
  };
}
