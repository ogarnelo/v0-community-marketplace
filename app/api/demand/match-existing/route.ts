import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessSuperadmin, hasValidAutomationSecret } from "@/lib/admin/superadmin-access";

export const dynamic = "force-dynamic";

function normalize(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesDemandRequest(request: any, listing: any) {
  const listingTitle = normalize(listing.title);
  const listingDescription = normalize(listing.description);
  const requestQuery = normalize(request.normalized_query || request.title);
  const requestIsbn = normalize(request.isbn);

  if (requestIsbn && normalize(listing.isbn) === requestIsbn) return true;

  if (request.category && listing.category !== request.category) return false;
  if (request.grade_level && listing.grade_level !== request.grade_level) return false;

  if (!requestQuery) return Boolean(request.category || request.grade_level);

  return (
    listingTitle.includes(requestQuery) ||
    listingDescription.includes(requestQuery) ||
    requestQuery.includes(listingTitle)
  );
}

async function alreadyMatched(admin: any, request: any, listing: any) {
  const { data } = await admin
    .from("demand_match_notifications")
    .select("id")
    .eq("demand_request_id", request.id)
    .eq("listing_id", listing.id)
    .eq("user_id", request.user_id)
    .maybeSingle();

  return Boolean(data?.id);
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const bySecret = hasValidAutomationSecret(request);
  const bySuperadmin = user ? await canAccessSuperadmin(user.id, user.email) : false;

  if (!bySecret && !bySuperadmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [{ data: demandRequests }, { data: listings }] = await Promise.all([
    admin
      .from("demand_requests")
      .select("id, user_id, title, normalized_query, category, grade_level, isbn, status")
      .eq("status", "open")
      .limit(500),
    admin
      .from("listings")
      .select("id, seller_id, title, description, category, grade_level, isbn, status, created_at")
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  let matches = 0;
  let notificationsCreated = 0;

  for (const demandRequest of demandRequests || []) {
    if (!demandRequest.user_id) continue;

    const matchedListings = (listings || [])
      .filter((listing: any) => listing.seller_id !== demandRequest.user_id)
      .filter((listing: any) => matchesDemandRequest(demandRequest, listing))
      .slice(0, 3);

    for (const listing of matchedListings) {
      matches += 1;

      if (await alreadyMatched(admin, demandRequest, listing)) continue;

      const { error: matchError } = await admin.from("demand_match_notifications").insert({
        demand_request_id: demandRequest.id,
        listing_id: listing.id,
        user_id: demandRequest.user_id,
        status: "notified",
      });

      if (matchError) continue;

      notificationsCreated += 1;

      await admin.from("notifications").insert({
        user_id: demandRequest.user_id,
        kind: "demand_request_match",
        title: "Ha aparecido algo que buscabas",
        body: `"${listing.title}" puede encajar con "${demandRequest.title}".`,
        href: `/marketplace/listing/${listing.id}`,
        metadata: {
          listing_id: listing.id,
          demand_request_id: demandRequest.id,
          source: "demand_match_existing",
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    demandRequests: (demandRequests || []).length,
    listings: (listings || []).length,
    matches,
    notificationsCreated,
    generatedAt: new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  return POST(request);
}
