import type { MetadataRoute } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { posts } from "@/lib/blog-data"
import { isDemoListing } from "@/lib/seo/demo-listing"
import { isDirectorySeoEnabled, isDirectoryCentreSeoEligible } from "@/lib/schools/directory-seo-eligibility"
import { directoryPageUrl } from "@/lib/schools/listed-directory-centre"

const SITE_URL = "https://www.wetudy.com"

/**
 * Strictly bounded by 24 candidate records until manual editorial review
 * certifies the SEO rollout. Missing/failing data never adds URLs.
 * The imported 34,845 directory records are NEVER listed automatically.
 */
async function approvedDirectorySeoPages(): Promise<MetadataRoute.Sitemap> {
  if (!isDirectorySeoEnabled()) return [];
  const directoryPages = await approvedDirectorySeoPages()

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("school_directory")
      .select("official_code,updated_at")
      .eq("is_listed", true)
      .eq("seo_indexable", true)
      .not("linked_school_id", "is", null)
      .order("official_code", { ascending: true })
      .limit(24);
    if (error || !Array.isArray(data)) return [];
    const pages: MetadataRoute.Sitemap = [];
    for (const centre of data) {
      if (typeof centre.official_code !== "string" ||
          !(await isDirectoryCentreSeoEligible(centre.official_code))) continue;
      pages.push({
        url: directoryPageUrl(centre.official_code),
        lastModified: centre.updated_at || undefined,
        changeFrequency: "monthly",
        priority: 0.4,
      });
    }
    return pages;
  } catch {
    return [];
  }
}

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fallbackNow = new Date()
  const seoRefresh = new Date("2026-09-20T00:00:00.000Z")
  const securityRefresh = new Date("2026-09-23T21:00:00.000Z")

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: seoRefresh, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/marketplace`, lastModified: seoRefresh, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/como-funciona`, lastModified: seoRefresh, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/vende-tus-libros`, lastModified: seoRefresh, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/about`, lastModified: seoRefresh, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/help`, lastModified: seoRefresh, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/seguridad`, lastModified: securityRefresh, changeFrequency: "monthly", priority: 0.65 },
    { url: `${SITE_URL}/blog`, lastModified: seoRefresh, changeFrequency: "weekly", priority: 0.6 },
  ]

  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(post.publishedAt),
    changeFrequency: "monthly",
    priority: 0.55,
  }))

  try {
    const admin = createAdminClient()
    const { data: listings } = await admin
      .from("listings")
      .select("id, title, updated_at, created_at, school_id")
      .eq("status", "available")
      .order("updated_at", { ascending: false })
      .limit(5000)

    const schoolIds = Array.from(
      new Set(
        (listings || [])
          .map((listing) => listing.school_id)
          .filter((schoolId): schoolId is string => Boolean(schoolId))
      )
    )

    const testSchoolIds = new Set<string>()
    if (schoolIds.length > 0) {
      const { data: testSchools } = await admin
        .from("schools")
        .select("id")
        .in("id", schoolIds)
        .eq("is_test", true)

      for (const school of testSchools || []) {
        testSchoolIds.add(school.id)
      }
    }

    const listingPages: MetadataRoute.Sitemap = (listings || [])
      .filter(
        (listing) =>
          !isDemoListing(listing) &&
          (!listing.school_id || !testSchoolIds.has(listing.school_id))
      )
      .map((listing) => ({
        url: `${SITE_URL}/marketplace/listing/${listing.id}`,
        lastModified: listing.updated_at || listing.created_at || fallbackNow,
        changeFrequency: "weekly",
        priority: 0.7,
      }))

    return [...staticPages, ...blogPages, ...listingPages, ...directoryPages]
  } catch (error) {
    console.error("No se pudieron añadir anuncios al sitemap:", error)
    return [...staticPages, ...blogPages, ...directoryPages]
  }
}
