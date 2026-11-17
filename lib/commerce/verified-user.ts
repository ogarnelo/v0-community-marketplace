import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type VerifiedCommerceUser =
  | { user: User; errorStatus: null }
  | { user: null; errorStatus: 401 | 503 };

/**
 * Never trust residual data.user returned alongside an Auth error.
 * This is used before Stripe Connect, payment quotes and service-role reads.
 */
export async function getVerifiedCommerceUser(): Promise<VerifiedCommerceUser> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      const guest = error.name === "AuthSessionMissingError" ||
        error.code === "session_not_found";
      return { user: null, errorStatus: guest ? 401 : 503 };
    }
    if (!data?.user) return { user: null, errorStatus: 401 };
    return { user: data.user, errorStatus: null };
  } catch {
    return { user: null, errorStatus: 503 };
  }
}
