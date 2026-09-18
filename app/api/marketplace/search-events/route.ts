import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchEventPayload = {
  query?: string | null;
  isbnQuery?: string | null;
  category?: string | null;
  gradeLevel?: string | null;
  listingType?: string | null;
  condition?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  onlyMyCommunity?: boolean;
  nearbyMode?: boolean;
  radiusKm?: number | null;
  resultsCount?: number | null;
  sourcePath?: string | null;
};

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 160) : null;
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as SearchEventPayload;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: true, skipped: true, reason: "auth_required_for_analytics" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle();

    const schoolId = profile?.school_id || null;
    const admin = createAdminClient();
    const { error } = await admin.from("marketplace_search_events").insert({
      user_id: user.id,
      school_id: schoolId,
      query: cleanText(payload.query),
      isbn_query: cleanText(payload.isbnQuery),
      category: cleanText(payload.category),
      grade_level: cleanText(payload.gradeLevel),
      listing_type: cleanText(payload.listingType),
      condition: cleanText(payload.condition),
      price_min: cleanNumber(payload.priceMin),
      price_max: cleanNumber(payload.priceMax),
      only_my_community: Boolean(payload.onlyMyCommunity),
      nearby_mode: Boolean(payload.nearbyMode),
      radius_km: Math.min(500, Math.max(0, cleanNumber(payload.radiusKm) || 0)) || null,
      results_count: Math.min(10000, Math.max(0, cleanNumber(payload.resultsCount) || 0)),
      source_path: "/marketplace",
    });

    if (error) {
      console.error("Error guardando señal de demanda:", error);
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error inesperado en search-events:", error);
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }
}
