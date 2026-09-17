import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/account/",
          "/auth/",
          "/checkout/",
          "/favorites/",
          "/messages/",
          "/onboarding/",
          "/profile/",
          "/marketplace/new",
          "/marketplace/edit/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
