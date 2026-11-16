import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Strict per-request identity. On a real provider error, do not treat a stale
// user as authenticated and do not misclassify an outage as a logout.
export const getCurrentUser = cache(async () => {
  let auth;
  try {
    const supabase = await createClient();
    auth = await supabase.auth.getUser();
  } catch {
    throw new Error("auth_user_unavailable");
  }
  if (auth.error) {
    const sessionMissing = auth.error.name === "AuthSessionMissingError" ||
      auth.error.code === "session_not_found";
    if (!sessionMissing) throw new Error("auth_user_unavailable");
    return null;
  }
  return auth.data?.user ?? null;
});
