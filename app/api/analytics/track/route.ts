import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function sanitizeProperties(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  return input as Record<string, unknown>;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await request.json().catch(() => null);

  const eventName = typeof body?.eventName === "string" ? body.eventName.trim() : "";
  const entityType = typeof body?.entityType === "string" ? body.entityType.trim() : null;
  const entityId = typeof body?.entityId === "string" && body.entityId.trim() ? body.entityId.trim() : null;

  if (!eventName || eventName.length > 100) {
    return NextResponse.json({ error: "Invalid event name" }, { status: 400 });
  }

  const { error } = await supabase.from("marketplace_events").insert({
    user_id: user?.id ?? null,
    event_name: eventName,
    entity_type: entityType,
    entity_id: entityId,
    properties: sanitizeProperties(body?.properties),
  });

  if (error) {
    console.error("analytics_track_error", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
