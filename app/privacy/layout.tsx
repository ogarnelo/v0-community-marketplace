import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Información de privacidad de Wetudy.",
  robots: { index: false, follow: true },
}

export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}
