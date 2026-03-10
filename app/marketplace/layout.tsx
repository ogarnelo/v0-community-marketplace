import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { createClient } from "@/lib/supabase/server"

export default async function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userName =
    user?.user_metadata?.full_name ||
    user?.email ||
    "Mi cuenta"

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar isLoggedIn={!!user} userName={userName} isAdmin={false} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
