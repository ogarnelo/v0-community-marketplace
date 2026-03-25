export type DashboardRangeKey = "30d" | "90d" | "180d" | "total";

export type DashboardListingLike = {
  id: string;
  category: string | null;
  grade_level: string | null;
  condition: string | null;
  price: number | null;
  status: string | null;
  type?: string | null;
  listing_type?: string | null;
  created_at: string;
};

export type DashboardProfileLike = {
  id: string;
  user_type: string | null;
  grade_level: string | null;
};

export type DashboardReportLike = {
  created_at: string;
};

export type DashboardListingViewLike = {
  listing_id: string;
  viewed_at: string;
};

type RankingRow = {
  label: string;
  total: number;
  percentage: number;
};

function normalizeListingType(value: {
  type?: string | null;
  listing_type?: string | null;
}) {
  return value.type === "donation" || value.listing_type === "donation"
    ? "donation"
    : "sale";
}

export function isWithinDashboardRange(
  date: string,
  range: DashboardRangeKey
) {
  if (range === "total") return true;

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return false;

  const now = new Date();
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 180;
  const start = new Date(now);
  start.setDate(now.getDate() - days);

  return parsed >= start;
}

export function buildDashboardPercentageRanking(
  items: Array<{ label: string; total: number }>,
  emptyLabel = "Sin datos"
): RankingRow[] {
  const total = items.reduce((sum, item) => sum + item.total, 0);

  if (total <= 0) {
    return [{ label: emptyLabel, total: 0, percentage: 0 }];
  }

  return items
    .filter((item) => item.total > 0)
    .map((item) => ({
      ...item,
      percentage: Number(((item.total / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

export function buildCommonDashboardAnalytics(args: {
  listings: DashboardListingLike[];
  reports: DashboardReportLike[];
  listingViews: DashboardListingViewLike[];
  profiles: DashboardProfileLike[];
  prettyCategory: (value?: string | null) => string;
  prettyGradeLevel: (value?: string | null) => string;
  prettyCondition: (value?: string | null) => string;
  prettyUserType: (value?: string | null) => string;
}) {
  const {
    listings,
    reports,
    listingViews,
    profiles,
    prettyCategory,
    prettyGradeLevel,
    prettyCondition,
    prettyUserType,
  } = args;

  const totalVisibleVolume = listings.reduce(
    (sum, listing) =>
      listing.status === "available" && typeof listing.price === "number"
        ? sum + listing.price
        : sum,
    0
  );

  const totalSales = listings.reduce(
    (sum, listing) =>
      listing.status === "sold" && typeof listing.price === "number"
        ? sum + listing.price
        : sum,
    0
  );

  const totalTransactions = listings.filter(
    (listing) => listing.status === "sold"
  ).length;

  const averageTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;

  const conversionRate =
    listingViews.length > 0
      ? (totalTransactions / listingViews.length) * 100
      : null;

  const byMonth = new Map<
    string,
    { month: string; listings: number; reports: number }
  >();

  const monthKey = (date: string) =>
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      month: "short",
      year: "2-digit",
    }).format(new Date(date));

  const addMonth = (date: string, key: "listings" | "reports") => {
    const bucketKey = monthKey(date);
    const current = byMonth.get(bucketKey) || {
      month: bucketKey,
      listings: 0,
      reports: 0,
    };

    current[key] += 1;
    byMonth.set(bucketKey, current);
  };

  listings.forEach((listing) => addMonth(listing.created_at, "listings"));
  reports.forEach((report) => addMonth(report.created_at, "reports"));

  const countMap = <T,>(items: T[], getLabel: (item: T) => string) => {
    const counts = new Map<string, number>();

    items.forEach((item) => {
      const key = getLabel(item);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return buildDashboardPercentageRanking(
      Array.from(counts.entries()).map(([label, total]) => ({ label, total }))
    );
  };

  const saleTotal = listings.filter(
    (listing) => normalizeListingType(listing) === "sale"
  ).length;

  const donationTotal = listings.filter(
    (listing) => normalizeListingType(listing) === "donation"
  ).length;

  return {
    totalVisibleVolume,
    totalSales,
    totalTransactions,
    averageTicket,
    conversionRate,
    monthlyActivityData: Array.from(byMonth.values()).slice(-6),
    listingTypeData: [
      { type: "sale", total: saleTotal },
      { type: "donation", total: donationTotal },
    ].filter((item) => item.total > 0),
    categoryRanking: countMap(
      listings,
      (listing) => prettyCategory(listing.category)
    ).slice(0, 8),
    listingGradeLevelRanking: countMap(
      listings,
      (listing) => prettyGradeLevel(listing.grade_level)
    ).slice(0, 8),
    userGradeLevelRanking: countMap(
      profiles,
      (profile) => prettyGradeLevel(profile.grade_level)
    ).slice(0, 8),
    conditionRanking: countMap(
      listings,
      (listing) => prettyCondition(listing.condition)
    ),
    userTypeRanking: countMap(
      profiles,
      (profile) => prettyUserType(profile.user_type)
    ),
  };
}