export const SEO_SITE_URL = "https://www.wetudy.com";
export const SEO_ORGANIZATION_ID = `${SEO_SITE_URL}/#organization`;
export const SEO_WEBSITE_ID = `${SEO_SITE_URL}/#website`;

export type BreadcrumbItem = {
  name: string;
  path?: string;
  url?: string;
};

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url || `${SEO_SITE_URL}${item.path || "/"}`,
    })),
  };
}
