import { createClient } from "@/lib/supabase/server"

export async function getCurrentProfile() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { user: null, profile: null }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error) {
    return { user, profile: null }
  }

  return { user, profile }
}