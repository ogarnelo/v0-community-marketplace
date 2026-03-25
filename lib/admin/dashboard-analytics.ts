export type DashboardRangeKey = "30d" | "90d" | "180d" | "total";

export function isWithinRange(date: string, range: DashboardRangeKey) {
  if (range === "total") return true;

  const now = new Date();
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return false;

  const days = range === "30d" ? 30 : range === "90d" ? 90 : 180;
  const start = new Date(now);
  start.setDate(now.getDate() - days);

  return parsed >= start;
}

export function filterRowsByRange<T>(
  rows: T[],
  getDate: (row: T) => string,
  range: DashboardRangeKey
) {
  return rows.filter((row) => isWithinRange(getDate(row), range));
}

export function buildPercentageRanking(
  items: Array<{ label: string; total: number }>,
  emptyLabel = "Sin datos"
) {
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

function monthKey(date: string) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    month: "short",
    year: "2-digit",
  }).format(parsed);
}

export function buildMonthlyListingReportSeries({
  listings,
  reports,
}: {
  listings: Array<{ created_at: string }>;
  reports: Array<{ created_at: string }>;
}) {
  const buckets = new Map<string, { month: string; listings: number; reports: number }>();

  const add = (date: string, key: "listings" | "reports") => {
    const bucketKey = monthKey(date);
    const current = buckets.get(bucketKey) || { month: bucketKey, listings: 0, reports: 0 };
    current[key] += 1;
    buckets.set(bucketKey, current);
  };

  listings.forEach((row) => add(row.created_at, "listings"));
  reports.forEach((row) => add(row.created_at, "reports"));

  return Array.from(buckets.values()).slice(-6);
}

export function buildMonthlyAdminSeries({
  listings,
  supportTickets,
  reports,
  requests,
}: {
  listings: Array<{ created_at: string }>;
  supportTickets: Array<{ created_at: string }>;
  reports: Array<{ created_at: string }>;
  requests: Array<{ created_at: string }>;
}) {
  const buckets = new Map<
    string,
    { month: string; listings: number; support: number; reports: number; requests: number }
  >();

  const add = (date: string, key: "listings" | "support" | "reports" | "requests") => {
    const bucketKey = monthKey(date);
    const current = buckets.get(bucketKey) || {
      month: bucketKey,
      listings: 0,
      support: 0,
      reports: 0,
      requests: 0,
    };

    current[key] += 1;
    buckets.set(bucketKey, current);
  };

  listings.forEach((row) => add(row.created_at, "listings"));
  supportTickets.forEach((row) => add(row.created_at, "support"));
  reports.forEach((row) => add(row.created_at, "reports"));
  requests.forEach((row) => add(row.created_at, "requests"));

  return Array.from(buckets.values()).slice(-6);
}
