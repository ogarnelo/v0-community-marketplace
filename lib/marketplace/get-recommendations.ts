import { createClient } from "@/lib/supabase/server";
import { getRankedListings } from "@/lib/marketplace/get-ranked-listings";

export async function getRecommendations(userId: string) {
  const supabase = await createClient();

  try {
    const { data: prefs } = await supabase
      .from("user_marketplace_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    return await getRankedListings({
      grade: prefs?.preferred_grade_level || null,
      category: Array.isArray(prefs?.preferred_categories) ? prefs.preferred_categories[0] : null,
      limit: 24,
      currentUserId: userId,
    });
  } catch {
    return await getRankedListings({ limit: 24, currentUserId: userId });
  }
}
