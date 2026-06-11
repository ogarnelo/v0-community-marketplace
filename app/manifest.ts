import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wetudy',
    short_name: 'Wetudy',
    description: 'Comunidad educativa para comprar, vender, donar y descubrir material escolar.',
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
