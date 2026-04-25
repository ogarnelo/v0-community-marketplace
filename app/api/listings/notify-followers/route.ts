
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotifications } from "@/lib/notifications";
import { sendFollowedUserListingEmail } from "@/lib/emails/transactional";

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

  const [{ data: listing }, { data: profile }, { data: follows }] = await Promise.all([
    adminSupabase
      .from("listings")
      .select("id, title, seller_id")
      .eq("id", listingId)
      .eq("seller_id", user.id)
      .maybeSingle(),
    adminSupabase
      .from("profiles")
      .select("id, full_name, business_name")
      .eq("id", user.id)
      .maybeSingle(),
    adminSupabase
      .from("user_follows")
      .select("follower_id")
      .eq("following_id", user.id),
  ]);

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const followerIds = (follows || [])
    .map((row: { follower_id: string }) => row.follower_id)
    .filter((id: string) => id && id !== user.id);

  if (followerIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const publisherName =
    profile?.business_name?.trim() ||
    profile?.full_name?.trim() ||
    user.user_metadata?.full_name ||
    "Un usuario";

  const listingUrl = `${getBaseUrl()}/marketplace/listing/${listing.id}`;

  const { error } = await createNotifications(
    adminSupabase,
    followerIds.map((followerId: string) => ({
      user_id: followerId,
      kind: "followed_user_listing_created",
      title: "Nuevo anuncio de un perfil que sigues",
      body: `${publisherName} ha publicado "${listing.title || "un nuevo anuncio"}".`,
      href: `/marketplace/listing/${listing.id}`,
      metadata: {
        listing_id: listing.id,
        publisher_id: user.id,
      },
    }))
  );

  if (error) {
    return NextResponse.json({ error: "No se pudieron crear las notificaciones" }, { status: 500 });
  }

  const { data: followerProfiles } = await adminSupabase
    .from("profiles")
    .select("id, full_name")
    .in("id", followerIds);

  const profileNameById = new Map((followerProfiles || []).map((row: any) => [row.id, row.full_name]));

  await Promise.allSettled(
    followerIds.map(async (followerId: string) => {
      const { data: userData } = await adminSupabase.auth.admin.getUserById(followerId);
      const email = userData?.user?.email;
      if (!email) return;

      await sendFollowedUserListingEmail({
        to: email,
        recipientName: profileNameById.get(followerId) || null,
        publisherName,
        listingTitle: listing.title || "Nuevo anuncio",
        listingUrl,
      });
    })
  );

  return NextResponse.json({ ok: true, sent: followerIds.length });
}
