
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendFavoriteAddedEmail } from "@/lib/emails/transactional";

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

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

  const [{ data: listing }, { data: actorProfile }] = await Promise.all([
    adminSupabase
      .from("listings")
      .select("id, title, seller_id")
      .eq("id", listingId)
      .maybeSingle(),
    adminSupabase
      .from("profiles")
      .select("full_name, business_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!listing || !listing.seller_id || listing.seller_id === user.id) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const actorName =
    actorProfile?.business_name?.trim() ||
    actorProfile?.full_name?.trim() ||
    user.user_metadata?.full_name ||
    "Alguien";

  await createNotification(adminSupabase, {
    user_id: listing.seller_id,
    kind: "listing_favorited",
    title: "Han guardado tu anuncio",
    body: `${actorName} ha guardado "${listing.title || "tu anuncio"}".`,
    href: `/marketplace/listing/${listing.id}`,
    metadata: {
      listing_id: listing.id,
      actor_id: user.id,
    },
  });

  const { data: sellerProfile } = await adminSupabase
    .from("profiles")
    .select("full_name")
    .eq("id", listing.seller_id)
    .maybeSingle();

  const { data: sellerUser } = await adminSupabase.auth.admin.getUserById(listing.seller_id);
  const sellerEmail = sellerUser?.user?.email;

  if (sellerEmail) {
    await sendFavoriteAddedEmail({
      to: sellerEmail,
      recipientName: sellerProfile?.full_name || null,
      actorName,
      listingTitle: listing.title || "Tu anuncio",
      listingUrl: `${getBaseUrl()}/marketplace/listing/${listing.id}`,
    }).catch((error) => {
      console.error("Error enviando email de favorito:", error);
    });
  }

  return NextResponse.json({ ok: true });
}
