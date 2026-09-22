import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function ensureSellerConnectAccount() {
  return { diagnostic: typeof createAdminClient === "function" };
}
