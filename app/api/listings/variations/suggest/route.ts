import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { variationIdeasForListing } from "@/lib/inventory/expansion";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";

  if (!listingId) {
    return NextResponse.json({ error: "Falta el anuncio." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: listing, error } = await admin
    .from("listings")
    .select("id, seller_id, title, category, grade_level, condition, price")
    .eq("id", listingId)
    .maybeSingle();

  if (error || !listing) {
    return NextResponse.json({ error: "El anuncio no existe." }, { status: 404 });
  }

  if (listing.seller_id !== user.id) {
    return NextResponse.json({ error: "No puedes generar variaciones de un anuncio que no es tuyo." }, { status: 403 });
  }

  const ideas = variationIdeasForListing(listing as any);

  await admin.from("inventory_expansion_events").insert({
    user_id: user.id,
    source_listing_id: listingId,
    event_type: "variation_suggested",
    metadata: {
      ideas_count: ideas.length,
    },
  });

  return NextResponse.json({ ok: true, ideas });
}
