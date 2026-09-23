import type { MetadataRoute } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { posts } from "@/lib/blog-data"

const SITE_URL = "https://www.wetudy.com"

export const revalidate = 0

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fallbackNow = new Date()
  const seoRefresh = new Date("2026-09-20T00:00:00.000Z")

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: seoRefresh, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/marketplace`, lastModified: seoRefresh, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/como-funciona`, lastModified: seoRefresh, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/vende-tus-libros`, lastModified: seoRefresh, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/about`, lastModified: seoRefresh, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/help`, lastModified: seoRefresh, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/seguridad`, lastModified: seoRefresh, changeFrequency: "monthly", priority: 0.65 },
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
      .select("id, updated_at, created_at")
      .eq("status", "available")
      .order("updated_at", { ascending: false })
      .limit(5000)

    const listingPages: MetadataRoute.Sitemap = (listings || []).map((listing) => ({
      url: `${SITE_URL}/marketplace/listing/${listing.id}`,
      lastModified: listing.updated_at || listing.created_at || fallbackNow,
      changeFrequency: "weekly",
      priority: 0.7,
    }))

    return [...staticPages, ...blogPages, ...listingPages]
  } catch (error) {
    console.error("No se pudieron añadir anuncios al sitemap:", error)
    return [...staticPages, ...blogPages]
  }
}
