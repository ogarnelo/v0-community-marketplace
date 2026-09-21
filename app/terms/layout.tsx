import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Condiciones de uso de Wetudy.",
  robots: { index: false, follow: true },
}

export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}
