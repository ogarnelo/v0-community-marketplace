import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wetudy',
    short_name: 'Wetudy',
    description: 'Marketplace educativo de segunda mano para libros, uniformes y material escolar.',
    start_url: '/marketplace',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1D9FDA',
    lang: 'es',
    categories: ['education', 'shopping', 'lifestyle'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
