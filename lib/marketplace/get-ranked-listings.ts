import { createClient } from "@/lib/supabase/server";

export async function getRankedListings(params?: {
  q?: string;
  category?: string;
  grade?: string;
  limit?: number;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select(`
      *,
      listing_signals(views, favorites, chats, offers, last_activity_at),
      listing_boosts(*)
    `)
    .eq("status", "available")
    .limit(params?.limit || 40);

  if (params?.q) query = query.ilike("title", `%${params.q}%`);
  if (params?.category) query = query.eq("category", params.category);
  if (params?.grade) query = query.eq("grade_level", params.grade);

  const { data } = await query;

  const scored = (data || []).map((l: any) => {
    const s = l.listing_signals?.[0] || {};
    const boostActive = (l.listing_boosts || []).some((b: any) => b.active);
    const score =
      (boostActive ? 1000 : 0) +
      (s.favorites || 0) * 5 +
      (s.offers || 0) * 6 +
      (s.chats || 0) * 3 +
      (s.views || 0) * 1 +
      (s.last_activity_at ? new Date(s.last_activity_at).getTime() / 1e13 : 0);

    return { ...l, _score: score };
  });

  scored.sort((a: any, b: any) => b._score - a._score);

  return scored;
}
