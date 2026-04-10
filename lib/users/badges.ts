export type BadgeTone = "emerald" | "amber" | "sky" | "violet" | "slate";

export type UserBadge = {
  key: string;
  label: string;
  description: string;
  tone: BadgeTone;
};

export type BadgeMetrics = {
  userType?: string | null;
  reviewCount: number;
  averageRating: number | null;
  activeListingsCount: number;
  soldListingsCount: number;
  donationListingsCount: number;
};

const BADGE_CATALOG: Record<string, UserBadge> = {
  community_member: {
    key: "community_member",
    label: "Miembro de la comunidad",
    description: "Forma parte de una comunidad educativa activa en Wetudy.",
    tone: "slate",
  },
  first_listing: {
    key: "first_listing",
    label: "Primer anuncio",
    description: "Ya ha publicado su primer artículo en Wetudy.",
    tone: "sky",
  },
  trusted_seller: {
    key: "trusted_seller",
    label: "Vendedor fiable",
    description: "Ha completado ventas con una valoración alta de forma consistente.",
    tone: "emerald",
  },
  top_seller: {
    key: "top_seller",
    label: "Top vendedor",
    description: "Ha completado un volumen relevante de ventas dentro del marketplace.",
    tone: "amber",
  },
  donor: {
    key: "donor",
    label: "Donante solidario",
    description: "Ha publicado artículos para donación dentro de Wetudy.",
    tone: "violet",
  },
  business_profile: {
    key: "business_profile",
    label: "Negocio local",
    description: "Perfil profesional de un comercio o negocio relacionado con educación.",
    tone: "sky",
  },
  well_rated: {
    key: "well_rated",
    label: "Muy bien valorado",
    description: "Mantiene una puntuación pública muy positiva por parte de otros usuarios.",
    tone: "emerald",
  },
};

export function getBadgeByKey(key: string): UserBadge | null {
  return BADGE_CATALOG[key] ?? null;
}

export function getBadgeToneClassName(tone: BadgeTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "violet":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "slate":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function deriveBadges(metrics: BadgeMetrics) {
  const badges: UserBadge[] = [BADGE_CATALOG.community_member];

  if (metrics.userType === "business") {
    badges.push(BADGE_CATALOG.business_profile);
  }

  if (metrics.activeListingsCount + metrics.soldListingsCount + metrics.donationListingsCount > 0) {
    badges.push(BADGE_CATALOG.first_listing);
  }

  if (metrics.donationListingsCount > 0) {
    badges.push(BADGE_CATALOG.donor);
  }

  if (metrics.reviewCount >= 3 && typeof metrics.averageRating === "number" && metrics.averageRating >= 4.5) {
    badges.push(BADGE_CATALOG.well_rated);
  }

  if (metrics.soldListingsCount >= 3 && typeof metrics.averageRating === "number" && metrics.averageRating >= 4.2) {
    badges.push(BADGE_CATALOG.trusted_seller);
  }

  if (metrics.soldListingsCount >= 10) {
    badges.push(BADGE_CATALOG.top_seller);
  }

  return badges;
}
