import "server-only";

type CourseNeedRow = {
  id: string;
  status: "active" | "fulfilled" | "archived";
  demand_request_id: string | null;
};

type DemandRow = {
  id: string;
  status: string;
  created_at: string;
  first_result_at: string | null;
  first_contact_at: string | null;
  first_agreement_at: string | null;
  resolved_at: string | null;
  matched_listing_id: string | null;
  conversation_id: string | null;
  confirmed_agreement_id: string | null;
};

type SavedSearchRow = {
  demand_request_id: string | null;
  notifications_enabled: boolean;
};

export type CourseNeedObservability = {
  activated: number;
  searching: number;
  withResult: number;
  contacted: number;
  withAgreement: number;
  paused: number;
  resolved: number;
  archived: number;
  inconsistent: number;
  conversion: {
    activationToResultPct: number | null;
    resultToContactPct: number | null;
    contactToAgreementPct: number | null;
    agreementToResolvedPct: number | null;
    activationToResolvedPct: number | null;
  };
  medianMinutes: {
    activationToResult: number | null;
    resultToContact: number | null;
    contactToAgreement: number | null;
    agreementToResolved: number | null;
    activationToResolved: number | null;
  };
  timingSamples: {
    activationToResult: number;
    resultToContact: number;
    contactToAgreement: number;
    agreementToResolved: number;
    activationToResolved: number;
  };
};

function percent(part: number, total: number) {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

function durationMinutes(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  return (endMs - startMs) / 60000;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return Math.round(sorted[middle] * 10) / 10;
  return Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10;
}

export function buildCourseNeedObservability(
  needs: CourseNeedRow[],
  demands: DemandRow[],
  searches: SavedSearchRow[]
): CourseNeedObservability {
  const needByDemandId = new Map(
    needs
      .filter((need) => need.demand_request_id)
      .map((need) => [need.demand_request_id as string, need])
  );
  const enabledDemandIds = new Set(
    searches
      .filter((search) => search.demand_request_id && search.notifications_enabled)
      .map((search) => search.demand_request_id as string)
  );
  const demandById = new Map(demands.map((demand) => [demand.id, demand]));

  let searching = 0;
  let withResult = 0;
  let contacted = 0;
  let withAgreement = 0;
  let paused = 0;
  let resolved = 0;
  let inconsistent = 0;

  const activationToResultDurations: number[] = [];
  const resultToContactDurations: number[] = [];
  const contactToAgreementDurations: number[] = [];
  const agreementToResolvedDurations: number[] = [];
  const activationToResolvedDurations: number[] = [];

  for (const demand of demands) {
    const need = needByDemandId.get(demand.id) || null;
    const alertsEnabled = enabledDemandIds.has(demand.id);
    const demandActive = demand.status === "open" || demand.status === "matched";
    const demandResolved = Boolean(demand.resolved_at || demand.confirmed_agreement_id);

    const demandHasResult = Boolean(demand.first_result_at || demand.matched_listing_id);
    const demandHasContact = Boolean(demand.first_contact_at || demand.conversation_id);
    const demandHasAgreement = Boolean(
      demand.first_agreement_at || demand.confirmed_agreement_id
    );

    if (demandHasResult) withResult += 1;
    if (demandHasContact) contacted += 1;
    if (demandHasAgreement) withAgreement += 1;
    if (demandResolved) resolved += 1;

    const toResult = durationMinutes(demand.created_at, demand.first_result_at);
    if (toResult != null) activationToResultDurations.push(toResult);

    const resultToContact = durationMinutes(
      demand.first_result_at,
      demand.first_contact_at
    );
    if (resultToContact != null) resultToContactDurations.push(resultToContact);

    const contactToAgreement = durationMinutes(
      demand.first_contact_at,
      demand.first_agreement_at
    );
    if (contactToAgreement != null) {
      contactToAgreementDurations.push(contactToAgreement);
    }

    const agreementToResolved = durationMinutes(
      demand.first_agreement_at,
      demand.resolved_at
    );
    if (agreementToResolved != null) {
      agreementToResolvedDurations.push(agreementToResolved);
    }

    const toResolved = durationMinutes(demand.created_at, demand.resolved_at);
    if (toResolved != null) activationToResolvedDurations.push(toResolved);

    if (!need || need.status !== "active") continue;

    if (demandActive && alertsEnabled) {
      searching += 1;
    } else if (demand.status === "dismissed" && !alertsEnabled && !demandResolved) {
      paused += 1;
    }

    const incompatible =
      (demandActive && !alertsEnabled) ||
      (demand.status === "dismissed" && alertsEnabled);
    if (incompatible) inconsistent += 1;
  }

  for (const need of needs) {
    if (
      need.status === "active" &&
      need.demand_request_id &&
      !demandById.has(need.demand_request_id)
    ) {
      inconsistent += 1;
    }
  }

  return {
    activated: demands.length,
    searching,
    withResult,
    contacted,
    withAgreement,
    paused,
    resolved,
    archived: needs.filter((need) => need.status === "archived").length,
    inconsistent,
    conversion: {
      activationToResultPct: percent(withResult, demands.length),
      resultToContactPct: percent(contacted, withResult),
      contactToAgreementPct: percent(withAgreement, contacted),
      agreementToResolvedPct: percent(resolved, withAgreement),
      activationToResolvedPct: percent(resolved, demands.length),
    },
    medianMinutes: {
      activationToResult: median(activationToResultDurations),
      resultToContact: median(resultToContactDurations),
      contactToAgreement: median(contactToAgreementDurations),
      agreementToResolved: median(agreementToResolvedDurations),
      activationToResolved: median(activationToResolvedDurations),
    },
    timingSamples: {
      activationToResult: activationToResultDurations.length,
      resultToContact: resultToContactDurations.length,
      contactToAgreement: contactToAgreementDurations.length,
      agreementToResolved: agreementToResolvedDurations.length,
      activationToResolved: activationToResolvedDurations.length,
    },
  };
}

export async function loadCourseNeedObservability(admin: any) {
  const [{ data: needs, error: needsError }, { data: demands, error: demandsError }, { data: searches, error: searchesError }] =
    await Promise.all([
      admin
        .from("course_needs")
        .select("id,status,demand_request_id")
        .not("demand_request_id", "is", null)
        .limit(5000),
      admin
        .from("demand_requests")
        .select("id,status,created_at,first_result_at,first_contact_at,first_agreement_at,resolved_at,matched_listing_id,conversation_id,confirmed_agreement_id")
        .eq("source", "course_need")
        .limit(5000),
      admin
        .from("saved_searches")
        .select("demand_request_id,notifications_enabled")
        .eq("intent_source", "course_need")
        .not("demand_request_id", "is", null)
        .limit(5000),
    ]);

  if (needsError) throw needsError;
  if (demandsError) throw demandsError;
  if (searchesError) throw searchesError;

  return buildCourseNeedObservability(
    (needs || []) as CourseNeedRow[],
    (demands || []) as DemandRow[],
    (searches || []) as SavedSearchRow[]
  );
}
