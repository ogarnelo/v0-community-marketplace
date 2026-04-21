
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";

const BOOST_COOLDOWN_DAYS = 7;

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const listingId = String(body?.listingId || "");

  if (!listingId) {
    return NextResponse.json({ error: "Missing listing id" }, { status: 400 });
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, title, seller_id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.seller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cooldownDate = new Date();
  cooldownDate.setDate(cooldownDate.getDate() - BOOST_COOLDOWN_DAYS);

  const { data: recentBoost } = await supabase
    .from("listing_boosts")
    .select("id, created_at")
    .eq("listing_id", listingId)
    .gte("created_at", cooldownDate.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentBoost) {
    return NextResponse.json(
      { error: "Este anuncio ya fue impulsado recientemente." },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("listing_boosts").insert({
    listing_id: listingId,
    user_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createNotification(supabase, {
    user_id: user.id,
    kind: "listing_boosted",
    title: "Anuncio impulsado",
    body: `Tu anuncio "${listing.title || "Anuncio"}" ha vuelto a ganar visibilidad.`,
    href: `/marketplace/listing/${listing.id}`,
    metadata: { listing_id: listing.id },
  });

  return NextResponse.json({ ok: true });
}
