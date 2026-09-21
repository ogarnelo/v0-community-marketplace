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
          return NextResponse.json({ ok: false }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ ok: false }, { status: 403 });
      }
    }

    const payload = await request.json().catch(() => ({}));
    const eventType =
      typeof payload?.eventType === "string" && allowedEventTypes.has(payload.eventType)
        ? payload.eventType
        : null;

    if (!eventType) {
      return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const admin = createAdminClient();

    if (eventType === "listing_published" || eventType === "school_joined") {
      const entityId = cleanUuid(payload?.entityId);
      if (!user) {
        return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
      }
      if (!entityId) {
        return NextResponse.json({ ok: false, error: "invalid_entity" }, { status: 400 });
      }

      try {
        const recorded = await recordAttributedConversion(admin, {
          userId: user.id,
          eventType,
          entityId,
        });
        return NextResponse.json({ ok: true, recorded });
      } catch (error) {
        console.error("No se pudo registrar la conversión atribuida:", error);
        return NextResponse.json({ ok: true, recorded: false });
      }
    }

    const source =
      cleanGrowthLabel(payload?.source, 120) ||
      cleanReferrerHost(payload?.referrerHost);

    if (!source) {
      return NextResponse.json({ ok: true, skipped: true, reason: "missing_source" });
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

    if (eventType === "attributed_user") {
      if (!user) {
        return NextResponse.json({ ok: true, linked: false });
      }

      const { data: existing } = await admin
        .from("growth_acquisition_events")
        .select("id")
        .eq("event_type", "attributed_user")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing?.id) {
        return NextResponse.json({ ok: true, linked: true, existing: true });
      }
    }

    const { error } = await admin.from("growth_acquisition_events").insert(row);

    if (error?.code === "23505" && eventType === "attributed_user") {
      return NextResponse.json({ ok: true, linked: true, existing: true });
    }

    if (error) {
      console.error("Error guardando atribución de crecimiento:", error);
      return NextResponse.json({ ok: true, skipped: true });
    }

    return NextResponse.json({
      ok: true,
      linked: eventType === "attributed_user" ? Boolean(user) : undefined,
    });
  } catch (error) {
    console.error("Error inesperado en atribución de crecimiento:", error);
    return NextResponse.json({ ok: true, skipped: true });
  }
}
