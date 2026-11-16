import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  cleanGrowthLabel,
  cleanGrowthPath,
  cleanReferrerHost,
} from "@/lib/growth/attribution";
import { recordAttributedConversion } from "@/lib/growth/server-attribution";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}


const allowedEventTypes = new Set([
  "landing",
  "attributed_user",
  "listing_published",
  "school_joined",
]);

function cleanUuid(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)
    ? trimmed
    : null;
}

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const origin = request.headers.get("origin");

    if (origin) {
      try {
        if (new URL(origin).host !== requestUrl.host) {
          return privateJson({ ok: false }, { status: 403 });
        }
      } catch {
        return privateJson({ ok: false }, { status: 403 });
      }
    }

    const payload = await request.json().catch(() => ({}));
    const eventType =
      typeof payload?.eventType === "string" && allowedEventTypes.has(payload.eventType)
        ? payload.eventType
        : null;

    if (!eventType) {
      return privateJson({ ok: false, error: "invalid_event" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const missingSession = authError?.name === "AuthSessionMissingError" ||
      authError?.code === "session_not_found";
    if (authError && !missingSession) {
      // Do not use a residual identity or silently treat an Auth outage as guest traffic.
      return privateJson({ ok: false, error: "auth_unavailable" }, { status: 503 });
    }
    const user = authError ? null : authData?.user ?? null;

    if (eventType === "listing_published" || eventType === "school_joined") {
      const entityId = cleanUuid(payload?.entityId);
      if (!user) {
        return privateJson({ ok: false, error: "auth_required" }, { status: 401 });
      }
      if (!entityId) {
        return privateJson({ ok: false, error: "invalid_entity" }, { status: 400 });
      }

      const admin = createAdminClient();
      try {
        const recorded = await recordAttributedConversion(admin, {
          userId: user.id,
          eventType,
          entityId,
        });
        return privateJson({ ok: true, recorded });
      } catch (error) {
        console.error("growth_conversion_record_failed");
        return privateJson({ ok: true, recorded: false });
      }
    }

    const source =
      cleanGrowthLabel(payload?.source, 120) ||
      cleanReferrerHost(payload?.referrerHost);

    if (!source) {
      return privateJson({ ok: true, skipped: true, reason: "missing_source" });
    }

    const row = {
      event_type: eventType,
      user_id: user?.id || null,
      entity_id: null,
      source,
      medium: cleanGrowthLabel(payload?.medium, 120),
      campaign: cleanGrowthLabel(payload?.campaign, 160),
      content: cleanGrowthLabel(payload?.content, 160),
      landing_path: cleanGrowthPath(payload?.landingPath),
      referrer_host: cleanReferrerHost(payload?.referrerHost),
    };

    if (eventType === "attributed_user" && !user) {
      return privateJson({ ok: true, linked: false });
    }

    const admin = createAdminClient();
    if (eventType === "attributed_user") {
      const { data: existing } = await admin
        .from("growth_acquisition_events")
        .select("id")
        .eq("event_type", "attributed_user")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing?.id) {
        return privateJson({ ok: true, linked: true, existing: true });
      }
    }

    const { error } = await admin.from("growth_acquisition_events").insert(row);

    if (error?.code === "23505" && eventType === "attributed_user") {
      return privateJson({ ok: true, linked: true, existing: true });
    }

    if (error) {
      console.error("growth_event_write_failed");
      return privateJson({ ok: true, skipped: true });
    }

    return privateJson({
      ok: true,
      linked: eventType === "attributed_user" ? Boolean(user) : undefined,
    });
  } catch (error) {
    console.error("growth_attribution_unexpected_failure");
    return privateJson({ ok: true, skipped: true });
  }
}
