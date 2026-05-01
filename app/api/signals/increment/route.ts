import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json().catch(() => null);

  const listingId = typeof body?.listingId === "string" ? body.listingId : null;
  const field = typeof body?.field === "string" ? body.field : null;

  if (!listingId || !field) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const allowed = new Set(["views","favorites","chats","offers"]);
  if (!allowed.has(field)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("listing_signals")
    .select("listing_id")
    .eq("listing_id", listingId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("listing_signals").insert({
      listing_id: listingId,
      [field]: 1,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    await supabase
      .from("listing_signals")
      .update({
        [field]: (supabase as any).rpc ? undefined : undefined,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("listing_id", listingId);

    // Fallback simple increment via SQL
    await supabase.rpc("increment_listing_signal", {
      p_listing_id: listingId,
      p_field: field,
    }).catch(()=>{});
  }

  return NextResponse.json({ ok: true });
}
