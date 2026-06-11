import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessSuperadmin, hasValidAutomationSecret } from "@/lib/admin/superadmin-access";
import { analyzeListingForModeration } from "@/lib/moderation/rules";

export const dynamic = "force-dynamic";

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

  const { data: listings, error } = await admin
    .from("listings")
    .select("id, seller_id, title, description, price, status, category, condition, created_at")
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let flagsCreated = 0;

  for (const listing of listings || []) {
    const signals = analyzeListingForModeration(listing);
    for (const signal of signals) {
      const { error: insertError } = await admin.from("moderation_flags").insert({
        listing_id: listing.id,
        user_id: listing.seller_id,
        flag_type: signal.flagType,
        severity: signal.severity,
        status: "open",
        reason: signal.reason,
        metadata: {
          ...signal.metadata,
          listing_title: listing.title,
        },
      });

      if (!insertError) flagsCreated += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: (listings || []).length,
    flagsCreated,
    generatedAt: new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  return POST(request);
}
