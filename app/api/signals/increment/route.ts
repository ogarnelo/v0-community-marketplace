import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PUBLIC_ALLOWED_FIELDS = new Set(["views"]);
const AUTHENTICATED_ALLOWED_FIELDS = new Set(["views"]);

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await req.json().catch(() => null);
  const listingId = typeof body?.listingId === "string" ? body.listingId : "";
  const field = typeof body?.field === "string" ? body.field : "";

  const allowedFields = user ? AUTHENTICATED_ALLOWED_FIELDS : PUBLIC_ALLOWED_FIELDS;

  if (!listingId || !allowedFields.has(field)) {
    return NextResponse.json({ ok: false, error: "Invalid signal" }, { status: 400 });
  }

  try {
    const { data: listing } = await supabase
      .from("listings")
      .select("id, status")
      .eq("id", listingId)
      .maybeSingle();

    if (!listing || listing.status !== "available") {
      return NextResponse.json({ ok: true });
    }

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
      console.error("increment_listing_signal error", error);
    }
  } catch (error) {
    console.error("signal increment failed", error);
  }

  return NextResponse.json({ ok: true });
}
