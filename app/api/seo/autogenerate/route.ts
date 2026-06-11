import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildCategoryGradeSeoPage,
  countActiveListingsForSeo,
  EVERGREEN_SEO_PAGES,
  isSafeSeoCategory,
  upsertSeoProgrammaticPage,
} from "@/lib/seo/programmatic";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.LAUNCH_HEALTH_SECRET;
  const url = new URL(request.url);
  const provided = url.searchParams.get("secret") || request.headers.get("x-health-secret");
  return Boolean(secret && provided && provided === secret);
}

function minListings() {
  const parsed = Number(process.env.SEO_AUTOPUBLISH_MIN_LISTINGS || 3);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;
}

async function runSeoGeneration() {
  const admin = createAdminClient();
  const minListingCount = minListings();
  const generated: any[] = [];

  for (const page of EVERGREEN_SEO_PAGES) {
    const activeListingCount = await countActiveListingsForSeo({
      category: page.category,
      gradeLevel: page.gradeLevel,
      query: page.query,
    });

    await upsertSeoProgrammaticPage({
      slug: page.slug,
      pageKind: page.pageKind,
      title: page.title,
      heading: page.heading,
      description: page.description,
      category: page.category,
      gradeLevel: page.gradeLevel,
      query: page.query,
      status: "published",
      minListingCount: 0,
      activeListingCount,
      sourceOpportunityScore: 0,
      metadata: { source: "evergreen_seed" },
    });

    generated.push({ slug: page.slug, status: "published", activeListingCount, source: "evergreen" });
  }

  const { data: opportunities, error } = await admin
    .from("demand_activation_opportunities_30d")
    .select("*")
    .gte("opportunity_score", 8)
    .limit(50);

  if (error) {
    console.error("seo_autogenerate_opportunities_error", error);
    return { generated, error: "No se pudieron leer oportunidades de demanda." };
  }

  for (const opportunity of opportunities || []) {
    if (!isSafeSeoCategory(opportunity.category)) continue;
    if (opportunity.region && opportunity.region !== "(sin región)") continue;
    if (opportunity.postal_prefix && opportunity.postal_prefix !== "(sin CP)") continue;

    const built = buildCategoryGradeSeoPage({
      category: opportunity.category,
      gradeLevel: opportunity.grade_level && opportunity.grade_level !== "(sin curso)" ? opportunity.grade_level : null,
      score: opportunity.opportunity_score,
      zeroResults: opportunity.zero_results,
      savedSearches: opportunity.saved_searches,
      explicitRequests: opportunity.explicit_requests,
      lastDemandSeenAt: opportunity.last_seen_at,
    });

    const activeListingCount = await countActiveListingsForSeo({
      category: built.category,
      gradeLevel: built.gradeLevel,
      query: null,
    });

    const shouldPublish = activeListingCount >= minListingCount;
    const status = shouldPublish ? "published" : "draft";

    await upsertSeoProgrammaticPage({
      slug: built.slug,
      pageKind: built.pageKind,
      title: built.title,
      heading: built.heading,
      description: built.description,
      category: built.category,
      gradeLevel: built.gradeLevel,
      query: built.query,
      status,
      minListingCount,
      activeListingCount,
      sourceOpportunityScore: built.score,
      sourceZeroResults: built.zeroResults,
      sourceSavedSearches: built.savedSearches,
      sourceExplicitRequests: built.explicitRequests,
      lastDemandSeenAt: built.lastDemandSeenAt,
      metadata: {
        source: "demand_activation_opportunities_30d",
        auto_publish_rule: shouldPublish ? "inventory_available" : "needs_inventory_or_review",
      },
    });

    generated.push({
      slug: built.slug,
      status,
      activeListingCount,
      score: built.score,
      source: "demand",
    });
  }

  return { generated };
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSeoGeneration();

  return NextResponse.json({
    ok: true,
    ...result,
    generatedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  return GET(request);
}
