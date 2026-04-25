
import { createAdminClient } from "@/lib/supabase/admin";

export async function getRelatedListings(category: string, excludeId: string) {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("listings")
    .select("id, title, price")
    .eq("category", category)
    .neq("id", excludeId)
    .limit(4);

  return data || [];
}
