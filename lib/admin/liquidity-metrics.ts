export type LiquidityProfile = {
  id: string;
  user_type: string | null;
  school_id: string | null;
  created_at: string | null;
};

export type LiquidityListing = {
  id: string;
  seller_id: string | null;
  school_id: string | null;
  category: string | null;
  grade_level: string | null;
  isbn: string | null;
  status: string | null;
  created_at: string | null;
};

export type LiquiditySearch = {
  id: string;
  user_id: string | null;
  school_id: string | null;
  category: string | null;
  grade_level: string | null;
  isbn_query: string | null;
  results_count: number | null;
  created_at: string;
};

export type LiquidityNeed = {
  id: string;
  user_id: string | null;
  school_id: string | null;
  category: string | null;
  grade_level: string | null;
  isbn: string | null;
  created_at: string;
  first_result_at: string | null;
  first_contact_at: string | null;
  first_agreement_at: string | null;
  resolved_at: string | null;
};

export type LiquidityAgreement = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  school_id: string | null;
  status: string;
  created_at: string;
  confirmed_at: string | null;
};

export type LiquidityAction = {
  id: string;
  target_user_id: string | null;
  resulting_listing_id: string | null;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
};

export type LiquiditySchool = {
  id: string;
  name: string;
  city: string | null;
  is_active: boolean | null;
};

export type LiquidityFilters = {
  periodStart: string | null;
  schoolId?: string | null;
  category?: string | null;
  gradeLevel?: string | null;
  isbn?: string | null;
};

export type RateMetric = {
  numerator: number;
  denominator: number;
  rate: number | null;
  lowSample: boolean;
};

export type LiquidityRow = {
  schoolId: string;
  schoolName: string;
  linkedFamilies: number;
  activeFamilies: number;
  activeListings: number;
  listingsPer100Families: number | null;
  searches: number;
  needs: number;
  searchSuccess: RateMetric;
  zeroResult: RateMetric;
  needToContact: RateMetric;
  contactToAgreement: RateMetric;
  nr7: RateMetric;
  nr14: RateMetric;
  medianTimeToContactHours: number | null;
  medianTimeToAgreementHours: number | null;
  confirmedAgreements: number;
  unmetNeeds: number;
  b1SupplyCreated: number;
  activatedSellers: number;
  activatedSellerToListing: RateMetric;
};

type Dataset = {
  profiles: LiquidityProfile[];
  listings: LiquidityListing[];
  searches: LiquiditySearch[];
  needs: LiquidityNeed[];
  agreements: LiquidityAgreement[];
  actions: LiquidityAction[];
  schools: LiquiditySchool[];
};

function clean(value?: string | null) {
  return (value || "").replace(/[^0-9A-Za-zÀ-ÿ]+/g, "").toLowerCase();
}

function sameOptional(value: string | null | undefined, filter: string | null | undefined) {
  if (!filter) return true;
  return clean(value) === clean(filter);
}

function inPeriod(value: string | null | undefined, periodStart: string | null) {
  if (!value) return false;
  if (!periodStart) return true;
  const time = new Date(value).getTime();
  const start = new Date(periodStart).getTime();
  return Number.isFinite(time) && Number.isFinite(start) && time >= start;
}

function ratio(numerator: number, denominator: number): RateMetric {
  return {
    numerator,
    denominator,
    rate: denominator > 0 ? numerator / denominator : null,
    lowSample: denominator > 0 && denominator < 5,
  };
}

function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function hoursBetween(start: string, end: string | null) {
  if (!end) return null;
  const delta = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(delta) && delta >= 0 ? delta / 3_600_000 : null;
}

function daysBetween(start: string, end: string | null) {
  const hours = hoursBetween(start, end);
  return hours == null ? null : hours / 24;
}

function listingMatchesFilters(listing: LiquidityListing, filters: LiquidityFilters) {
  return (
    sameOptional(listing.category, filters.category) &&
    sameOptional(listing.grade_level, filters.gradeLevel) &&
    (!filters.isbn || clean(listing.isbn).includes(clean(filters.isbn)))
  );
}

function searchMatchesFilters(search: LiquiditySearch, filters: LiquidityFilters) {
  return (
    sameOptional(search.category, filters.category) &&
    sameOptional(search.grade_level, filters.gradeLevel) &&
    (!filters.isbn || clean(search.isbn_query).includes(clean(filters.isbn)))
  );
}

function needMatchesFilters(need: LiquidityNeed, filters: LiquidityFilters) {
  return (
    sameOptional(need.category, filters.category) &&
    sameOptional(need.grade_level, filters.gradeLevel) &&
    (!filters.isbn || clean(need.isbn).includes(clean(filters.isbn)))
  );
}

export function buildLiquidityRows(dataset: Dataset, filters: LiquidityFilters): LiquidityRow[] {
  const listingById = new Map(dataset.listings.map((listing) => [listing.id, listing]));
  const schoolCandidates = dataset.schools.filter((school) =>
    !filters.schoolId || school.id === filters.schoolId
  );

  const rows = schoolCandidates.map((school) => {
    const linkedParentProfiles = dataset.profiles.filter(
      (profile) => profile.school_id === school.id && profile.user_type === "parent"
    );
    const linkedParentIds = new Set(linkedParentProfiles.map((profile) => profile.id));

    const schoolListings = dataset.listings.filter(
      (listing) => listing.school_id === school.id && listingMatchesFilters(listing, filters)
    );
    const activeListings = schoolListings.filter((listing) => listing.status === "available").length;

    const periodSearches = dataset.searches.filter(
      (search) =>
        search.school_id === school.id &&
        inPeriod(search.created_at, filters.periodStart) &&
        searchMatchesFilters(search, filters)
    );

    const periodNeeds = dataset.needs.filter(
      (need) =>
        need.school_id === school.id &&
        inPeriod(need.created_at, filters.periodStart) &&
        needMatchesFilters(need, filters)
    );

    const filteredListingIds = new Set(schoolListings.map((listing) => listing.id));
    const periodAgreements = dataset.agreements.filter(
      (agreement) => {
        const listing = listingById.get(agreement.listing_id);
        if (agreement.school_id !== school.id) return false;
        if (agreement.status !== "confirmed" || !inPeriod(agreement.confirmed_at, filters.periodStart)) return false;
        if ((filters.category || filters.gradeLevel || filters.isbn) && (!listing || !filteredListingIds.has(listing.id))) return false;
        return true;
      }
    );

    const activeUserIds = new Set<string>();
    for (const search of periodSearches) if (search.user_id && linkedParentIds.has(search.user_id)) activeUserIds.add(search.user_id);
    for (const need of periodNeeds) if (need.user_id && linkedParentIds.has(need.user_id)) activeUserIds.add(need.user_id);
    for (const listing of schoolListings) {
      if (listing.seller_id && linkedParentIds.has(listing.seller_id) && inPeriod(listing.created_at, filters.periodStart)) {
        activeUserIds.add(listing.seller_id);
      }
    }
    for (const agreement of periodAgreements) {
      if (linkedParentIds.has(agreement.buyer_id)) activeUserIds.add(agreement.buyer_id);
      if (linkedParentIds.has(agreement.seller_id)) activeUserIds.add(agreement.seller_id);
    }

    const validSearches = periodSearches.filter((search) => typeof search.results_count === "number");
    const successfulSearches = validSearches.filter((search) => Number(search.results_count) > 0).length;
    const zeroSearches = validSearches.filter((search) => Number(search.results_count) === 0).length;

    const needsWithContact = periodNeeds.filter((need) => Boolean(need.first_contact_at)).length;
    const contactedNeeds = periodNeeds.filter((need) => Boolean(need.first_contact_at));
    const contactsWithAgreement = contactedNeeds.filter((need) => Boolean(need.first_agreement_at)).length;
    const nr7Count = periodNeeds.filter((need) => {
      const days = daysBetween(need.created_at, need.resolved_at);
      return days != null && days <= 7;
    }).length;
    const nr14Count = periodNeeds.filter((need) => {
      const days = daysBetween(need.created_at, need.resolved_at);
      return days != null && days <= 14;
    }).length;

    const contactTimes = periodNeeds
      .map((need) => hoursBetween(need.created_at, need.first_contact_at))
      .filter((value): value is number => value != null);
    const agreementTimes = periodNeeds
      .map((need) => hoursBetween(need.created_at, need.first_agreement_at))
      .filter((value): value is number => value != null);

    const actionsInScope = dataset.actions.filter((action) => {
      if (!inPeriod(action.sent_at || action.created_at, filters.periodStart)) return false;
      if (!action.resulting_listing_id) {
        const targetProfile = dataset.profiles.find((profile) => profile.id === action.target_user_id);
        return targetProfile?.school_id === school.id;
      }
      const listing = listingById.get(action.resulting_listing_id);
      return Boolean(listing && listing.school_id === school.id && listingMatchesFilters(listing, filters));
    });

    const activationTargets = new Set(
      actionsInScope.map((action) => action.target_user_id).filter((id): id is string => Boolean(id))
    );
    const generatedListings = new Set(
      actionsInScope.map((action) => action.resulting_listing_id).filter((id): id is string => Boolean(id))
    );

    return {
      schoolId: school.id,
      schoolName: school.name,
      linkedFamilies: linkedParentProfiles.length,
      activeFamilies: activeUserIds.size,
      activeListings,
      listingsPer100Families: linkedParentProfiles.length > 0
        ? (activeListings / linkedParentProfiles.length) * 100
        : null,
      searches: periodSearches.length,
      needs: periodNeeds.length,
      searchSuccess: ratio(successfulSearches, validSearches.length),
      zeroResult: ratio(zeroSearches, validSearches.length),
      needToContact: ratio(needsWithContact, periodNeeds.length),
      contactToAgreement: ratio(contactsWithAgreement, contactedNeeds.length),
      nr7: ratio(nr7Count, periodNeeds.length),
      nr14: ratio(nr14Count, periodNeeds.length),
      medianTimeToContactHours: median(contactTimes),
      medianTimeToAgreementHours: median(agreementTimes),
      confirmedAgreements: periodAgreements.length,
      unmetNeeds: periodNeeds.filter((need) => !need.first_result_at && !need.resolved_at).length,
      b1SupplyCreated: generatedListings.size,
      activatedSellers: activationTargets.size,
      activatedSellerToListing: ratio(
        new Set(
          actionsInScope
            .filter((action) => Boolean(action.resulting_listing_id))
            .map((action) => action.target_user_id)
            .filter((id): id is string => Boolean(id))
        ).size,
        activationTargets.size
      ),
    };
  });

  return rows
    .filter((row) =>
      row.linkedFamilies > 0 ||
      row.activeListings > 0 ||
      row.searches > 0 ||
      row.needs > 0 ||
      row.confirmedAgreements > 0 ||
      row.b1SupplyCreated > 0
    )
    .sort((a, b) => b.needs - a.needs || b.searches - a.searches || a.schoolName.localeCompare(b.schoolName, "es"));
}

export function combineLiquidityRows(rows: LiquidityRow[]): LiquidityRow {
  const sum = (pick: (row: LiquidityRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const linkedFamilies = sum((row) => row.linkedFamilies);
  const activeListings = sum((row) => row.activeListings);
  const searchSuccessNumerator = sum((row) => row.searchSuccess.numerator);
  const searchSuccessDenominator = sum((row) => row.searchSuccess.denominator);
  const zeroNumerator = sum((row) => row.zeroResult.numerator);
  const zeroDenominator = sum((row) => row.zeroResult.denominator);
  const contactNumerator = sum((row) => row.needToContact.numerator);
  const contactDenominator = sum((row) => row.needToContact.denominator);
  const agreementNumerator = sum((row) => row.contactToAgreement.numerator);
  const agreementDenominator = sum((row) => row.contactToAgreement.denominator);
  const nr7Numerator = sum((row) => row.nr7.numerator);
  const nr7Denominator = sum((row) => row.nr7.denominator);
  const nr14Numerator = sum((row) => row.nr14.numerator);
  const nr14Denominator = sum((row) => row.nr14.denominator);
  const activatedNumerator = sum((row) => row.activatedSellerToListing.numerator);
  const activatedDenominator = sum((row) => row.activatedSellerToListing.denominator);

  return {
    schoolId: "*",
    schoolName: "Total filtrado",
    linkedFamilies,
    activeFamilies: sum((row) => row.activeFamilies),
    activeListings,
    listingsPer100Families: linkedFamilies > 0 ? (activeListings / linkedFamilies) * 100 : null,
    searches: sum((row) => row.searches),
    needs: sum((row) => row.needs),
    searchSuccess: ratio(searchSuccessNumerator, searchSuccessDenominator),
    zeroResult: ratio(zeroNumerator, zeroDenominator),
    needToContact: ratio(contactNumerator, contactDenominator),
    contactToAgreement: ratio(agreementNumerator, agreementDenominator),
    nr7: ratio(nr7Numerator, nr7Denominator),
    nr14: ratio(nr14Numerator, nr14Denominator),
    medianTimeToContactHours: null,
    medianTimeToAgreementHours: null,
    confirmedAgreements: sum((row) => row.confirmedAgreements),
    unmetNeeds: sum((row) => row.unmetNeeds),
    b1SupplyCreated: sum((row) => row.b1SupplyCreated),
    activatedSellers: sum((row) => row.activatedSellers),
    activatedSellerToListing: ratio(activatedNumerator, activatedDenominator),
  };
}
