import { createAdminClient } from "@/lib/supabase/admin";

type NudgeInput = {
  nudgeKey: string;
  userId: string;
  listingId?: string | null;
  nudgeType:
    | "listing_has_demand"
    | "publish_more_like_this"
    | "price_adjustment"
    | "respond_to_offer"
    | "complete_profile"
    | "share_listing";
  message: string;
  href?: string | null;
  actionLabel?: string | null;
  metadata?: Record<string, unknown>;
};

function normalize(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function sameCategoryDemand(listing: any, opportunity: any) {
  const listingCategory = normalize(listing.category);
  const opportunityCategory = normalize(opportunity.category);
  const listingGrade = normalize(listing.grade_level);
  const opportunityGrade = normalize(opportunity.grade_level);

  if (!listingCategory || !opportunityCategory || opportunityCategory === "(sin categoria)") return false;
  if (listingCategory !== opportunityCategory) return false;

  if (opportunityGrade && opportunityGrade !== "(sin curso)" && listingGrade && listingGrade !== opportunityGrade) {
    return false;
  }

  return true;
}

async function countRows(table: string, column: string, value: string) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);

  if (error) return 0;
  return count || 0;
}

async function upsertNudge(input: NudgeInput) {
  const admin = createAdminClient();

  const { error } = await admin.from("conversion_nudges").upsert(
    {
      nudge_key: input.nudgeKey,
      user_id: input.userId,
      listing_id: input.listingId || null,
      nudge_type: input.nudgeType,
      status: "pending",
      message: input.message,
      href: input.href || null,
      action_label: input.actionLabel || null,
      metadata: input.metadata || {},
    },
    { onConflict: "nudge_key" }
  );

  return !error;
}

export async function generateConversionNudges() {
  const admin = createAdminClient();
  const created: string[] = [];

  const [{ data: listings }, { data: opportunities }] = await Promise.all([
    admin
      .from("listings")
      .select("id, seller_id, title, description, category, grade_level, price, status, created_at")
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("demand_activation_opportunities_30d")
      .select("*")
      .order("opportunity_score", { ascending: false })
      .limit(50),
  ]);

  const highDemand = (opportunities || []).filter((opportunity: any) => Number(opportunity.opportunity_score || 0) >= 8);

  for (const listing of listings || []) {
    const sellerId = listing.seller_id;
    if (!sellerId) continue;

    const matchingOpportunity = highDemand.find((opportunity: any) => sameCategoryDemand(listing, opportunity));

    if (matchingOpportunity) {
      const ok = await upsertNudge({
        nudgeKey: `listing-demand:${listing.id}:${matchingOpportunity.demand_key}`,
        userId: sellerId,
        listingId: listing.id,
        nudgeType: "listing_has_demand",
        message: `Tu anuncio "${listing.title}" encaja con una demanda activa. Responde rápido y considera publicar productos similares.`,
        href: `/marketplace/listing/${listing.id}`,
        actionLabel: "Ver anuncio",
        metadata: {
          opportunity_score: matchingOpportunity.opportunity_score,
          demand_key: matchingOpportunity.demand_key,
          category: matchingOpportunity.category,
          grade_level: matchingOpportunity.grade_level,
        },
      });

      if (ok) created.push(`listing-demand:${listing.id}`);
    }

    const favoritesCount = await countRows("favorites", "listing_id", listing.id);
    const offersCount = await countRows("listing_offers", "listing_id", listing.id);

    if (favoritesCount >= 3 && offersCount === 0) {
      const ok = await upsertNudge({
        nudgeKey: `price-adjustment:${listing.id}`,
        userId: sellerId,
        listingId: listing.id,
        nudgeType: "price_adjustment",
        message: `"${listing.title}" tiene ${favoritesCount} favoritos pero ninguna oferta. Una pequeña rebaja o mejor descripción puede ayudarte a vender antes.`,
        href: `/marketplace/edit/${listing.id}`,
        actionLabel: "Mejorar anuncio",
        metadata: {
          favorites_count: favoritesCount,
          offers_count: offersCount,
        },
      });

      if (ok) created.push(`price-adjustment:${listing.id}`);
    }

    const createdAt = listing.created_at ? new Date(listing.created_at).getTime() : 0;
    const ageHours = createdAt ? (Date.now() - createdAt) / (1000 * 60 * 60) : 999;

    if (ageHours <= 72) {
      const ok = await upsertNudge({
        nudgeKey: `share-listing:${listing.id}`,
        userId: sellerId,
        listingId: listing.id,
        nudgeType: "share_listing",
        message: `Comparte "${listing.title}" en tus grupos de clase o familia para acelerar las primeras visitas.`,
        href: `/marketplace/listing/${listing.id}`,
        actionLabel: "Compartir anuncio",
        metadata: {
          age_hours: Math.round(ageHours),
        },
      });

      if (ok) created.push(`share-listing:${listing.id}`);
    }
  }

  const listingsBySellerCategory = new Map<string, number>();
  for (const listing of listings || []) {
    const key = `${listing.seller_id}:${normalize(listing.category)}`;
    listingsBySellerCategory.set(key, (listingsBySellerCategory.get(key) || 0) + 1);
  }

  const sellers = [...new Set((listings || []).map((listing: any) => listing.seller_id).filter(Boolean))];

  for (const sellerId of sellers) {
    for (const opportunity of highDemand.slice(0, 10)) {
      const category = normalize(opportunity.category);
      if (!category || category === "(sin categoria)") continue;

      const key = `${sellerId}:${category}`;
      const sellerCount = listingsBySellerCategory.get(key) || 0;

      if (sellerCount > 0 && sellerCount < 4) {
        const ok = await upsertNudge({
          nudgeKey: `publish-more:${sellerId}:${category}`,
          userId: sellerId,
          listingId: null,
          nudgeType: "publish_more_like_this",
          message: `Hay demanda en ${opportunity.category}. Si tienes más productos similares, publícalos ahora para aumentar opciones de venta.`,
          href: "/marketplace/new?source=conversion_nudge",
          actionLabel: "Publicar similar",
          metadata: {
            category: opportunity.category,
            opportunity_score: opportunity.opportunity_score,
            seller_existing_count: sellerCount,
          },
        });

        if (ok) created.push(`publish-more:${sellerId}:${category}`);
      }
    }
  }

  return {
    ok: true,
    nudgesCreatedOrUpdated: created.length,
    generatedAt: new Date().toISOString(),
  };
}
