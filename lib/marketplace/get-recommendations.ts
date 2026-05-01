import { createClient } from "@/lib/supabase/server";

export async function getRecommendations(userId: string) {
  const supabase = await createClient();

  const { data: prefs } = await supabase
    .from("user_marketplace_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let query = supabase
    .from("listings")
    .select("*")
    .eq("status", "available")
    .limit(20);

  if (prefs?.preferred_grade_level) {
    query = query.eq("grade_level", prefs.preferred_grade_level);
  }

  if (prefs?.preferred_categories?.length) {
    query = query.in("category", prefs.preferred_categories);
  }

  const { data } = await query;

  return data || [];
}
