
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { listingId } = await req.json();

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, price")
    .eq("id", listingId)
    .single();

  const { data: favorites } = await supabase
    .from("favorites")
    .select("user_id")
    .eq("listing_id", listingId);

  for (const fav of favorites || []) {
    await createNotification(supabase, {
      user_id: fav.user_id,
      kind: "price_drop",
      title: "Precio actualizado",
      body: `El anuncio "${listing.title}" ha cambiado de precio`,
      href: `/marketplace/listing/${listing.id}`,
    });
  }

  return NextResponse.json({ ok: true });
}
