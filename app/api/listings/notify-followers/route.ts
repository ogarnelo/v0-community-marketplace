import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotifications } from "@/lib/notifications";
import { sendFollowedUserListingEmail } from "@/lib/emails/transactional";
import { sendSavedSearchMatchEmail } from "@/lib/emails/alerts";

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function matchesSavedSearch(search: any, listing: any) {
  const title = normalize(listing.title);
  const description = normalize(listing.description);
  const query = normalize(search.query);
  const isbn = normalize(search.isbn);

  if (query && !title.includes(query) && !description.includes(query)) return false;
  if (isbn && normalize(listing.isbn) !== isbn) return false;
  if (search.category && listing.category !== search.category) return false;
  if (search.grade_level && listing.grade_level !== search.grade_level) return false;
  if (search.condition && listing.condition !== search.condition) return false;
  if (search.listing_type && listing.listing_type !== search.listing_type && listing.type !== search.listing_type) return false;

  const price = typeof listing.price === "number" ? listing.price : Number(listing.price);
  if (search.min_price !== null && search.min_price !== undefined && Number.isFinite(price) && price < Number(search.min_price)) return false;
  if (search.max_price !== null && search.max_price !== undefined && Number.isFinite(price) && price > Number(search.max_price)) return false;

  return true;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const listingId = String(body?.listingId || "");

  if (!listingId) return NextResponse.json({ error: "Missing listing id" }, { status: 400 });

  const [{ data: listing }, { data: profile }, { data: follows }, { data: savedSearches }] = await Promise.all([
    adminSupabase.from("listings").select("id, title, description, category, grade_level, condition, type, listing_type, isbn, price, seller_id").eq("id", listingId).eq("seller_id", user.id).maybeSingle(),
    adminSupabase.from("profiles").select("id, full_name, business_name").eq("id", user.id).maybeSingle(),
    adminSupabase.from("user_follows").select("follower_id").eq("following_id", user.id),
    adminSupabase.from("saved_searches").select("id, user_id, name, query, category, grade_level, condition, listing_type, isbn, min_price, max_price, email_enabled, push_enabled").neq("user_id", user.id),
  ]);

  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const followerIds = (follows || []).map((row: { follower_id: string }) => row.follower_id).filter((id: string) => id && id !== user.id);
  const publisherName = profile?.business_name?.trim() || profile?.full_name?.trim() || user.user_metadata?.full_name || "Un usuario";
  const listingTitle = listing.title || "Nuevo anuncio";
  const listingUrl = `${getBaseUrl()}/marketplace/listing/${listing.id}`;

  const followerNotifications = followerIds.map((followerId: string) => ({
    user_id: followerId,
    kind: "followed_user_listing_created",
    title: "Nuevo anuncio de un perfil que sigues",
    body: `${publisherName} ha publicado "${listingTitle}".`,
    href: `/marketplace/listing/${listing.id}`,
    metadata: { listing_id: listing.id, publisher_id: user.id },
  }));

  const matchingSearches = (savedSearches || []).filter((search: any) => matchesSavedSearch(search, listing));
  const searchNotifications = matchingSearches.filter((search: any) => search.push_enabled !== false).map((search: any) => ({
    user_id: search.user_id,
    kind: "saved_search_match",
    title: "Nuevo anuncio para una búsqueda guardada",
    body: `"${listingTitle}" coincide con "${search.name}".`,
    href: `/marketplace/listing/${listing.id}`,
    metadata: { listing_id: listing.id, saved_search_id: search.id },
  }));

  const allNotifications = [...followerNotifications, ...searchNotifications];
  if (allNotifications.length > 0) {
    await createNotifications(adminSupabase, allNotifications);
  }

  const uniqueEmailTargets = Array.from(new Set([...followerIds, ...matchingSearches.map((search: any) => search.user_id)]));
  const userProfiles = new Map<string, { full_name?: string | null; email?: string | null }>();

  await Promise.allSettled(uniqueEmailTargets.map(async (targetId) => {
    const [{ data: profileData }, { data: userData }] = await Promise.all([
      adminSupabase.from("profiles").select("full_name").eq("id", targetId).maybeSingle(),
      adminSupabase.auth.admin.getUserById(targetId),
    ]);
    userProfiles.set(targetId, { full_name: profileData?.full_name || null, email: userData?.user?.email || null });
  }));

  await Promise.allSettled(followerIds.map(async (followerId) => {
    const target = userProfiles.get(followerId);
    if (!target?.email) return;
    await sendFollowedUserListingEmail({
      to: target.email,
      recipientName: target.full_name || null,
      publisherName,
      listingTitle,
      listingUrl,
    });
  }));

  await Promise.allSettled(matchingSearches.filter((search: any) => search.email_enabled !== false).map(async (search: any) => {
    const target = userProfiles.get(search.user_id);
    if (!target?.email) return;
    await sendSavedSearchMatchEmail({
      to: target.email,
      searchName: search.name,
      listingTitle,
      listingId: listing.id,
    });
  }));

  return NextResponse.json({ ok: true, followerNotifications: followerNotifications.length, savedSearchNotifications: searchNotifications.length });
}
