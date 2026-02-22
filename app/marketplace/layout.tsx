import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar isLoggedIn userName="Ana" isAdmin />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
