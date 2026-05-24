import { createAdminClient } from "@/lib/supabase/admin";
import {
  cleanDemandMetadata,
  normalizeDemandOptional,
  normalizeDemandText,
  normalizeIsbn,
  postalPrefix,
} from "@/lib/demand/normalize";

export const DEMAND_EVENT_TYPES = new Set([
  "marketplace_browse",
  "search_performed",
  "zero_result_search",
  "saved_search_created",
  "catalog_material_added",
  "listing_created",
  "listing_viewed",
  "favorite_created",
  "chat_started",
  "offer_created",
  "checkout_started",
  "payment_completed",
  "donation_requested",
]);

export type DemandEventInput = {
  eventType: string;
  userId?: string | null;
  query?: string | null;
  category?: string | null;
  gradeLevel?: string | null;
  condition?: string | null;
  listingType?: string | null;
  isbn?: string | null;
  resultCount?: number | null;
  postalCode?: string | null;
  region?: string | null;
  schoolId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
};

function safeResultCount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.floor(number);
}

export async function recordDemandEvent(input: DemandEventInput) {
  if (!DEMAND_EVENT_TYPES.has(input.eventType)) return { ok: false, skipped: true };

  try {
    const admin = createAdminClient();

    const payload = {
      event_type: input.eventType,
      user_id: input.userId || null,
      normalized_query: normalizeDemandText(input.query, 120),
      category: normalizeDemandOptional(input.category, 80),
      grade_level: normalizeDemandOptional(input.gradeLevel, 80),
      condition: normalizeDemandOptional(input.condition, 40),
      listing_type: normalizeDemandOptional(input.listingType, 40),
      isbn: normalizeIsbn(input.isbn),
      result_count: safeResultCount(input.resultCount),
      postal_prefix: postalPrefix(input.postalCode),
      region: normalizeDemandOptional(input.region, 80),
      school_id: input.schoolId || null,
      source: normalizeDemandOptional(input.source, 40) || "web",
      metadata: cleanDemandMetadata(input.metadata),
    };

    const { error } = await admin.from("demand_events").insert(payload);

    if (error) {
      console.error("record_demand_event_error", error);
      return { ok: false, error };
    }

    return { ok: true };
  } catch (error) {
    console.error("record_demand_event_exception", error);
    return { ok: false, error };
  }
}

export async function getUserDemandContext(userId: string | null | undefined) {
  if (!userId) {
    return {
      userId: null,
      postalCode: null,
      region: null,
      schoolId: null,
    };
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("id, postal_code, school_id, schools(region)")
      .eq("id", userId)
      .maybeSingle();

    const schoolRegion =
      Array.isArray((data as any)?.schools)
        ? (data as any)?.schools?.[0]?.region
        : (data as any)?.schools?.region;

    return {
      userId,
      postalCode: (data as any)?.postal_code || null,
      region: schoolRegion || null,
      schoolId: (data as any)?.school_id || null,
    };
  } catch {
    return {
      userId,
      postalCode: null,
      region: null,
      schoolId: null,
    };
  }
}
