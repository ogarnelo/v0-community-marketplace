import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_FIELDS = new Set(["views", "favorites", "chats", "offers"]);

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json().catch(() => null);

  const listingId = typeof body?.listingId === "string" ? body.listingId : "";
  const field = typeof body?.field === "string" ? body.field : "";

  if (!listingId || !ALLOWED_FIELDS.has(field)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await supabase.from("listing_signals").upsert(
      {
        listing_id: listingId,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "listing_id" }
    );

    const { error } = await supabase.rpc("increment_listing_signal", {
      p_listing_id: listingId,
      p_field: field,
    });

    if (error) {
      console.warn("increment_listing_signal skipped", error.message);
    }
  } catch (error) {
    console.warn("signal increment skipped", error);
  }

  return NextResponse.json({ ok: true });
}
