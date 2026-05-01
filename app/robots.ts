import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wetudy.com'

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/marketplace', '/about', '/negocios', '/seguridad', '/impacto'],
      disallow: ['/admin', '/account', '/messages', '/api'],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  }
}
