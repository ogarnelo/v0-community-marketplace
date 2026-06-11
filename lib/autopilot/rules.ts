import { createAdminClient } from "@/lib/supabase/admin";

type RecommendationInput = {
  recommendationKey: string;
  recommendationType:
    | "demand_gap"
    | "business_acquisition"
    | "seo_review"
    | "conversion"
    | "moderation"
    | "liquidity"
    | "trust"
    | "operations";
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  href?: string | null;
  actionLabel?: string | null;
  impactScore?: number;
  metadata?: Record<string, unknown>;
};

function safeSlug(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function upsertRecommendation(input: RecommendationInput) {
  const admin = createAdminClient();

  return admin.from("autopilot_recommendations").upsert(
    {
      recommendation_key: input.recommendationKey,
      recommendation_type: input.recommendationType,
      title: input.title,
      description: input.description,
      severity: input.severity,
      status: "open",
      href: input.href || null,
      action_label: input.actionLabel || null,
      impact_score: input.impactScore || 0,
      metadata: input.metadata || {},
    },
    { onConflict: "recommendation_key" }
  );
}

export async function runAutopilotGrowthRules() {
  const admin = createAdminClient();
  const recommendations: RecommendationInput[] = [];

  const { data: opportunities } = await admin
    .from("demand_activation_opportunities_30d")
    .select("*")
    .order("opportunity_score", { ascending: false })
    .limit(30);

  for (const opportunity of opportunities || []) {
    const label =
      opportunity.normalized_query && opportunity.normalized_query !== "(sin búsqueda)"
        ? opportunity.normalized_query
        : opportunity.category || "Producto demandado";

    const grade = opportunity.grade_level && opportunity.grade_level !== "(sin curso)" ? opportunity.grade_level : null;
    const fullLabel = grade ? `${label} · ${grade}` : label;
    const key = `demand-gap:${safeSlug(fullLabel)}:${safeSlug(opportunity.region || "")}:${safeSlug(opportunity.postal_prefix || "")}`;

    const urgent = opportunity.explicit_requests >= 3 || opportunity.zero_results >= 8;
    const high = opportunity.opportunity_score >= 20;

    recommendations.push({
      recommendationKey: key,
      recommendationType: "demand_gap",
      title: urgent ? `Urgente: falta oferta para ${fullLabel}` : `Oportunidad: ${fullLabel}`,
      description:
        opportunity.recommendation_reason ||
        "Hay señales de demanda suficientes para captar oferta o publicar productos relacionados.",
      severity: urgent ? "critical" : high ? "high" : "medium",
      href: "/account/business/opportunities",
      actionLabel: "Ver oportunidades",
      impactScore: opportunity.opportunity_score || 0,
      metadata: {
        opportunity,
      },
    });

    if (urgent || high) {
      recommendations.push({
        recommendationKey: `campaign:${key}`,
        recommendationType: "business_acquisition",
        title: `Campaña sugerida para ${fullLabel}`,
        description:
          "Contacta negocios locales o vendedores activos para traer oferta de esta categoría. Prioriza lotes o packs si aplica.",
        severity: urgent ? "critical" : "high",
        href: "/admin/super/campaigns",
        actionLabel: "Ver campañas",
        impactScore: (opportunity.opportunity_score || 0) + 5,
        metadata: {
          suggested_action: "supplier_outreach",
          opportunity,
        },
      });
    }
  }

  const { data: seoDrafts } = await admin
    .from("seo_programmatic_pages")
    .select("id, slug, heading, active_listing_count, source_opportunity_score")
    .eq("status", "draft")
    .order("source_opportunity_score", { ascending: false })
    .limit(20);

  if ((seoDrafts || []).length > 0) {
    recommendations.push({
      recommendationKey: "seo:drafts-to-review",
      recommendationType: "seo_review",
      title: `${seoDrafts?.length || 0} páginas SEO en draft`,
      description:
        "Revisa páginas SEO generadas automáticamente. Publica solo las que tengan inventario y valor real para evitar contenido de baja calidad.",
      severity: "medium",
      href: "/admin/super/seo",
      actionLabel: "Revisar SEO",
      impactScore: Math.min((seoDrafts?.length || 0) * 2, 30),
      metadata: {
        drafts: seoDrafts || [],
      },
    });
  }

  const { data: moderationFlags } = await admin
    .from("moderation_flags")
    .select("id, severity")
    .eq("status", "open")
    .limit(50);

  const criticalModeration = (moderationFlags || []).filter((flag: any) => flag.severity === "critical" || flag.severity === "high").length;
  if ((moderationFlags || []).length > 0) {
    recommendations.push({
      recommendationKey: "moderation:open-flags",
      recommendationType: "moderation",
      title: `${moderationFlags?.length || 0} avisos de moderación pendientes`,
      description:
        "Revisa anuncios con señales de pago externo, contacto externo, precio sospechoso o baja calidad.",
      severity: criticalModeration > 0 ? "high" : "medium",
      href: "/admin/super/moderation",
      actionLabel: "Revisar moderación",
      impactScore: (moderationFlags?.length || 0) + criticalModeration * 5,
      metadata: {
        open_flags: moderationFlags?.length || 0,
        critical_or_high: criticalModeration,
      },
    });
  }

  const { data: businesses } = await admin
    .from("profiles")
    .select("id, business_name, user_type")
    .eq("user_type", "business")
    .limit(100);

  if ((businesses || []).length > 0) {
    const businessIds = (businesses || []).map((business: any) => business.id);
    const { data: listings } = await admin
      .from("listings")
      .select("id, seller_id")
      .in("seller_id", businessIds)
      .limit(500);

    const listingCountBySeller = new Map<string, number>();
    for (const listing of listings || []) {
      listingCountBySeller.set(listing.seller_id, (listingCountBySeller.get(listing.seller_id) || 0) + 1);
    }

    const emptyBusinesses = (businesses || []).filter((business: any) => (listingCountBySeller.get(business.id) || 0) === 0);
    const lowInventoryBusinesses = (businesses || []).filter((business: any) => {
      const count = listingCountBySeller.get(business.id) || 0;
      return count > 0 && count < 5;
    });

    if (emptyBusinesses.length > 0) {
      recommendations.push({
        recommendationKey: "business:no-products",
        recommendationType: "liquidity",
        title: `${emptyBusinesses.length} negocios sin productos`,
        description:
          "Estos negocios no están aportando liquidez todavía. Empújalos al onboarding rápido y a productos demandados.",
        severity: "high",
        href: "/account/business/onboarding",
        actionLabel: "Ver onboarding",
        impactScore: emptyBusinesses.length * 5,
        metadata: {
          business_ids: emptyBusinesses.map((item: any) => item.id).slice(0, 20),
        },
      });
    }

    if (lowInventoryBusinesses.length > 0) {
      recommendations.push({
        recommendationKey: "business:low-inventory",
        recommendationType: "liquidity",
        title: `${lowInventoryBusinesses.length} negocios con poco inventario`,
        description:
          "Un negocio con menos de 5 productos difícilmente generará transacciones. Sugiere subir lotes o packs.",
        severity: "medium",
        href: "/account/business/import",
        actionLabel: "Importar productos",
        impactScore: lowInventoryBusinesses.length * 3,
        metadata: {
          business_ids: lowInventoryBusinesses.map((item: any) => item.id).slice(0, 20),
        },
      });
    }
  }

  const results = [];
  for (const recommendation of recommendations) {
    results.push(await upsertRecommendation(recommendation));
  }

  return {
    ok: true,
    recommendationsCreatedOrUpdated: results.length,
    generatedAt: new Date().toISOString(),
  };
}
