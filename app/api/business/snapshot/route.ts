import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.user_type !== "business") {
    return NextResponse.json({ error: "Only business users can create snapshots" }, { status: 403 });
  }

  const [{ count: activeListings }, { count: soldListings }, { count: followers }] = await Promise.all([
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "available"),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "sold"),
    supabase
      .from("user_follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", user.id),
  ]);

  const { error } = await supabase.from("business_metrics_snapshots").insert({
    business_id: user.id,
    active_listings_count: activeListings || 0,
    sold_listings_count: soldListings || 0,
    followers_count: followers || 0,
    total_views_count: 0,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
