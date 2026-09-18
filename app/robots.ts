import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/marketplace", "/marketplace/listing/", "/about", "/help", "/como-funciona", "/vende-tus-libros", "/blog"],
        disallow: [
          "/api/",
          "/admin/",
          "/account/",
          "/auth",
          "/checkout/",
          "/favorites",
          "/messages/",
          "/marketplace/new",
          "/marketplace/edit/",
          "/onboarding/",
          "/register-school",
        ],
      },
    ],
    sitemap: "https://www.wetudy.com/sitemap.xml",
    host: "https://www.wetudy.com",
  }
}
