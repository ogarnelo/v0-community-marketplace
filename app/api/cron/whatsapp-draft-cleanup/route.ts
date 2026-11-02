import { createAdminClient } from "@/lib/supabase/admin";
import { isWhatsappPilotSandboxSafe } from "@/lib/whatsapp/pilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Preview-only retention endpoint. It is NOT scheduled automatically:
 * operator must configure an authenticated scheduler before enabling users.
 */
export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_CLEANUP_SECRET;
  if (!isWhatsappPilotSandboxSafe() || process.env.VERCEL_ENV !== "preview" ||
      process.env.WHATSAPP_PILOT_ENABLED !== "true" ||
      !secret || secret.length < 32 ||
      request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 404 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: sessions, error } = await admin.from("whatsapp_listing_sessions")
    .select("user_id,updated_at,in_flight_until,draft_photo_path")
    .lt("updated_at", cutoff).order("updated_at", { ascending: true }).limit(50);
  if (error) return Response.json({ error: "cleanup unavailable" }, { status: 503 });

  let reset = 0;
  for (const row of sessions || []) {
    if (row.in_flight_until && new Date(row.in_flight_until).getTime() > Date.now()) continue;

    // Photo deletion must succeed before forgetting the path.
    if (row.draft_photo_path) {
      const { error: storageError } = await admin.storage
        .from("whatsapp-draft-photos").remove([row.draft_photo_path]);
      if (storageError) continue;
    }

    const { error: resetError } = await admin.from("whatsapp_listing_sessions")
      .update({ step: "idle", payload: {}, draft_photo_path: null, lease_id: null, in_flight_until: null, updated_at: new Date().toISOString() })
      .eq("user_id", row.user_id).eq("updated_at", row.updated_at)
      .or(`in_flight_until.is.null,in_flight_until.lt.${new Date().toISOString()}`);
    if (!resetError) reset++;
  }

  const { error: oldEventsError } = await admin.from("whatsapp_incoming_events")
    .delete().lt("created_at", new Date(Date.now() - 14 * 86400_000).toISOString());
  const { error: oldQuotasError } = await admin.from("whatsapp_ai_daily_usage")
    .delete().lt("usage_day", new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));

  return Response.json({
    ok: !oldEventsError && !oldQuotasError,
    sessionsChecked: sessions?.length || 0,
    reset,
    requiresAnotherBatch: (sessions?.length || 0) === 50,
  }, {
    status: oldEventsError || oldQuotasError ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
