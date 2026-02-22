import { Navbar } from "@/components/navbar"

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <Navbar isLoggedIn userName="Ana" isAdmin />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
