import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo/site";
import { posts } from "@/lib/blog-data";

export const revalidate = 3600;

const staticPages: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/marketplace", changeFrequency: "daily", priority: 0.95 },
  { path: "/vende-tus-libros", changeFrequency: "monthly", priority: 0.8 },
  { path: "/como-funciona", changeFrequency: "monthly", priority: 0.8 },
  { path: "/about", changeFrequency: "monthly", priority: 0.65 },
  { path: "/help", changeFrequency: "monthly", priority: 0.6 },
  { path: "/blog", changeFrequency: "monthly", priority: 0.65 },
  { path: "/impacto", changeFrequency: "monthly", priority: 0.55 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = staticPages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  const editorialEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly",
    priority: 0.55,
  }));

  try {
    const admin = createAdminClient();
    const { data: listings, error } = await admin
      .from("listings")
      .select("id, created_at, updated_at")
      .eq("status", "available")
      .order("updated_at", { ascending: false })
      .limit(1000);

    if (error) throw error;

    const listingEntries: MetadataRoute.Sitemap = (listings || []).map((listing) => ({
      url: `${SITE_URL}/marketplace/listing/${listing.id}`,
      lastModified: new Date(listing.updated_at || listing.created_at || Date.now()),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    return [...staticEntries, ...editorialEntries, ...listingEntries];
  } catch (error) {
    console.error("Error generando sitemap de anuncios:", error);
    return [...staticEntries, ...editorialEntries];
  }
}
