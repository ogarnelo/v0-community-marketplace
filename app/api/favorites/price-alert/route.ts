import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotifications } from "@/lib/notifications";
import { sendPriceDropEmail } from "@/lib/emails/alerts";

export async function POST(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const listingId = String(body?.listingId || "");
  if (!listingId) return NextResponse.json({ error: "Missing listing id" }, { status: 400 });

  const { data: listing } = await adminSupabase.from("listings").select("id, title, seller_id").eq("id", listingId).maybeSingle();
  if (!listing || listing.seller_id !== user.id) return NextResponse.json({ ok: true, skipped: true });

  const { data: favorites } = await adminSupabase.from("favorites").select("user_id").eq("listing_id", listingId);
  const favoriteUserIds = (favorites || []).map((fav: { user_id: string }) => fav.user_id).filter(Boolean);

  await createNotifications(adminSupabase, favoriteUserIds.map((userId: string) => ({
    user_id: userId,
    kind: "price_drop",
    title: "Precio actualizado",
    body: `El anuncio "${listing.title || "Anuncio"}" ha cambiado de precio.`,
    href: `/marketplace/listing/${listing.id}`,
    metadata: { listing_id: listing.id },
  })));

  await Promise.allSettled(favoriteUserIds.map(async (userId: string) => {
    const { data: authUser } = await adminSupabase.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;
    if (!email) return;
    await sendPriceDropEmail({ to: email, listingTitle: listing.title || "Anuncio", listingId: listing.id });
  }));

  return NextResponse.json({ ok: true, sent: favoriteUserIds.length });
}
