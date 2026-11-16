import { createClient } from "@/lib/supabase/server";

export async function getCurrentProfile() {
  let supabase;
  let auth;
  try {
    supabase = await createClient();
    auth = await supabase.auth.getUser();
  } catch {
    throw new Error("auth_profile_unavailable");
  }
  if (auth.error) {
    const sessionMissing = auth.error.name === "AuthSessionMissingError" ||
      auth.error.code === "session_not_found";
    if (!sessionMissing) throw new Error("auth_profile_unavailable");
    return { user: null, profile: null };
  }
  const user = auth.data?.user ?? null;
  if (!user) return { user: null, profile: null };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return { user, profile: null };
  return { user, profile };
}
