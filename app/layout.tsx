import type { Metadata, Viewport } from "next"
import { Inter, DM_Sans } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import { SessionInactivityGuard } from "@/components/auth/session-inactivity-guard"
import "./globals.css"

const SITE_URL = "https://www.wetudy.com"
const SITE_TITLE = "Wetudy | Reutiliza material escolar entre familias"
const SITE_DESCRIPTION =
  "Compra, vende o dona libros, uniformes y material escolar de segunda mano. Contacta por chat y acuerda la entrega y el pago directamente entre las partes."

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Wetudy",
  title: {
    default: SITE_TITLE,
    template: "%s | Wetudy",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "material escolar de segunda mano",
    "libros de texto usados",
    "uniformes escolares de segunda mano",
    "comprar material escolar usado",
    "vender libros de texto",
    "donar material escolar",
  ],
  creator: "Wetudy",
  publisher: "Wetudy",
  category: "education",
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: `${SITE_URL}/`,
    siteName: "Wetudy",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
}

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${dmSans.variable} font-sans antialiased`}>
        {children}
        <SessionInactivityGuard />
        <Toaster position="top-right" />
        <Analytics />
      </body>
    </html>
  )
}
