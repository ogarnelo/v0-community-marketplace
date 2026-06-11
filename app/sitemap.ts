import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wetudy.com'
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${appUrl}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${appUrl}/marketplace`, lastModified: now, changeFrequency: 'daily', priority: 0.95 },
    { url: `${appUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${appUrl}/negocios`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${appUrl}/seguridad`, lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${appUrl}/impacto`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${appUrl}/legal/privacidad`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${appUrl}/legal/terminos`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${appUrl}/legal/proteccion-comprador`, lastModified: now, changeFrequency: 'yearly', priority: 0.35 },
  ]

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('listings')
      .select('id, updated_at, created_at')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(300)

    const listings = (data || []).map((listing: any) => ({
      url: `${appUrl}/marketplace/listing/${listing.id}`,
      lastModified: new Date(listing.updated_at || listing.created_at || now),
      changeFrequency: 'weekly' as const,
      priority: 0.65,
    }))

    return [...staticRoutes, ...listings]
  } catch {
    return staticRoutes
  }
}
