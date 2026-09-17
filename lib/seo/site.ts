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
