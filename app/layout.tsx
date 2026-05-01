import type { Metadata, Viewport } from 'next'
import { Inter, DM_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", weight: ["400", "500", "600", "700"] })

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wetudy.com'

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Wetudy - Marketplace educativo de segunda mano',
    template: '%s | Wetudy',
  },
  description: 'Compra, vende, dona y reutiliza libros, uniformes y material educativo dentro de tu comunidad. Chat, ofertas, pagos protegidos y perfiles de confianza.',
  applicationName: 'Wetudy',
  generator: 'Wetudy',
  keywords: [
    'marketplace educativo',
    'libros segunda mano',
    'uniformes segunda mano',
    'material escolar barato',
    'reutilización educativa',
    'Wetudy',
  ],
  authors: [{ name: 'Wetudy' }],
  creator: 'Wetudy',
  publisher: 'Wetudy',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: appUrl,
    siteName: 'Wetudy',
    title: 'Wetudy - Marketplace educativo de segunda mano',
    description: 'Ahorra comprando y vendiendo libros, uniformes y material educativo dentro de tu comunidad.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wetudy - Marketplace educativo de segunda mano',
    description: 'Compra, vende, dona y reutiliza material educativo con confianza.',
  },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Wetudy',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#1D9FDA',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${dmSans.variable} min-h-screen overflow-x-hidden pb-20 font-sans antialiased md:pb-0`}>
        {children}
        <Toaster position="top-right" />
        <Analytics />
      </body>
    </html>
  )
}
