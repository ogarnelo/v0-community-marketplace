import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MarketplaceEvents } from "@/lib/analytics/events";

function normalizeString(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function normalizeArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 12);
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  const payload = {
    user_id: user.id,
    role_context: normalizeString(body?.roleContext),
    preferred_grade_level: normalizeString(body?.preferredGradeLevel),
    preferred_categories: normalizeArray(body?.preferredCategories),
    looking_for: normalizeArray(body?.lookingFor),
    selling_intent: normalizeArray(body?.sellingIntent),
    postal_code: normalizeString(body?.postalCode),
    city: normalizeString(body?.city),
    onboarding_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("user_marketplace_preferences")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("marketplace_events").insert({
    user_id: user.id,
    event_name: MarketplaceEvents.OnboardingCompleted,
    entity_type: "user",
    entity_id: user.id,
    properties: {
      preferred_grade_level: payload.preferred_grade_level,
      preferred_categories: payload.preferred_categories,
      looking_for: payload.looking_for,
      selling_intent: payload.selling_intent,
    },
  });

  return NextResponse.json({ ok: true });
}
