"use client"

import { createClient } from "@/lib/supabase/client"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { LogOut } from "lucide-react"

export function LogoutButton() {
  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.assign("/auth")
  }

  return (
    <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer text-destructive">
      <LogOut className="h-4 w-4" />
      Cerrar sesión
    </DropdownMenuItem>
  )
}