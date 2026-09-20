export type SchoolDashboardRangeKey = "90d" | "365d" | "total";

export type SchoolDashboardRangeMetrics = {
  publishedListings: number;
  reusedItems: number;
  donatedItems: number;
  soldItems: number;
  circularValue: number;
  reusedBooks: number;
  estimatedAvoidedCo2: number;
  unquantifiedItems: number;
  listingViews: number;
  reuseRate: number;
};

export type SchoolDashboardMetrics = {
  ranges: Record<SchoolDashboardRangeKey, SchoolDashboardRangeMetrics>;
  membersCount: number;
  schoolAdminsCount: number;
  listingsHistoricalCount: number;
  activeListings: number;
  openReports: number;
};

type ListingMetricRow = {
  id: string;
  title: string | null;
  category: string | null;
  isbn: string | null;
  status: string | null;
  created_at: string | null;
};

type AgreementMetricRow = {
  listing_id: string | null;
  agreement_type: string | null;
  status: string | null;
  amount: number | null;
  confirmed_at: string | null;
  created_at: string | null;
};

type ListingViewMetricRow = {
  viewed_at: string | null;
};

const SCHOOL_BOOK_CO2E_KG = 2.1;

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isSchoolBook(listing: ListingMetricRow | undefined) {
  if (!listing) return false;
  if (listing.isbn?.trim()) return true;

  const text = normalize(`${listing.category || ""} ${listing.title || ""}`);
  return ["libro", "libros", "texto", "lectura", "textbook", "book", "manual"].some(
    (token) => text.includes(token)
  );
}

function isWithinRange(value: string | null, range: SchoolDashboardRangeKey, now: Date) {
  if (!value) return false;
  if (range === "total") return true;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  const start = new Date(now);
  start.setDate(start.getDate() - (range === "90d" ? 90 : 365));
  return parsed >= start;
}

export function buildSchoolDashboardMetrics(params: {
  listings: ListingMetricRow[];
  agreements: AgreementMetricRow[];
  listingViews: ListingViewMetricRow[];
  openReports: number;
  membersCount: number;
  schoolAdminsCount: number;
  now?: Date;
}): SchoolDashboardMetrics {
  const now = params.now || new Date();
  const listingById = new Map(params.listings.map((listing) => [listing.id, listing]));

  const ranges = Object.fromEntries(
    (["90d", "365d", "total"] as const).map((range) => {
      const publishedListings = params.listings.filter((listing) =>
        isWithinRange(listing.created_at, range, now)
      ).length;
      const confirmedAgreements = params.agreements.filter(
        (agreement) =>
          agreement.status === "confirmed" &&
          isWithinRange(agreement.confirmed_at || agreement.created_at, range, now)
      );
      const reusedItems = confirmedAgreements.length;
      const donatedItems = confirmedAgreements.filter(
        (agreement) => agreement.agreement_type === "donation"
      ).length;
      const soldItems = reusedItems - donatedItems;
      const circularValue = confirmedAgreements.reduce(
        (sum, agreement) =>
          agreement.agreement_type !== "donation" && typeof agreement.amount === "number"
            ? sum + agreement.amount
            : sum,
        0
      );
      const reusedBooks = confirmedAgreements.filter((agreement) =>
        agreement.listing_id ? isSchoolBook(listingById.get(agreement.listing_id)) : false
      ).length;
      const listingViews = params.listingViews.filter((view) =>
        isWithinRange(view.viewed_at, range, now)
      ).length;

      return [
        range,
        {
          publishedListings,
          reusedItems,
          donatedItems,
          soldItems,
          circularValue,
          reusedBooks,
          estimatedAvoidedCo2: reusedBooks * SCHOOL_BOOK_CO2E_KG,
          unquantifiedItems: Math.max(0, reusedItems - reusedBooks),
          listingViews,
          reuseRate:
            publishedListings > 0 ? Math.min(100, (reusedItems / publishedListings) * 100) : 0,
        },
      ];
    })
  ) as Record<SchoolDashboardRangeKey, SchoolDashboardRangeMetrics>;

  return {
    ranges,
    membersCount: params.membersCount,
    schoolAdminsCount: params.schoolAdminsCount,
    listingsHistoricalCount: params.listings.length,
    activeListings: params.listings.filter((listing) =>
      ["available", "reserved"].includes(listing.status || "")
    ).length,
    openReports: params.openReports,
  };
}
