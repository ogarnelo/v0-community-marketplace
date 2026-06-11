import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidAutomationSecret } from "@/lib/admin/superadmin-access";
import { countActiveListingsForSeo } from "@/lib/seo/programmatic";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasValidAutomationSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: pages, error } = await admin
    .from("seo_programmatic_pages")
    .select("id, slug, status, category, grade_level, query, min_listing_count")
    .in("status", ["published", "draft", "noindex"])
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const updates = [];

  for (const page of pages || []) {
    const activeListingCount = await countActiveListingsForSeo({
      category: page.category,
      gradeLevel: page.grade_level,
      query: page.query,
    });

    let nextStatus = page.status;
    if (page.status === "published" && page.min_listing_count > 0 && activeListingCount < page.min_listing_count) {
      nextStatus = "noindex";
    }

    const { error: updateError } = await admin
      .from("seo_programmatic_pages")
      .update({
        active_listing_count: activeListingCount,
        status: nextStatus,
      })
      .eq("id", page.id);

    updates.push({
      slug: page.slug,
      ok: !updateError,
      activeListingCount,
      previousStatus: page.status,
      nextStatus,
      error: updateError?.message,
    });
  }

  return NextResponse.json({
    ok: updates.every((item) => item.ok),
    updates,
    generatedAt: new Date().toISOString(),
  });
}
