import "server-only";

type CourseNeedRow = {
  id: string;
  status: "active" | "fulfilled" | "archived";
  demand_request_id: string | null;
};

type DemandRow = {
  id: string;
  status: string;
  first_result_at: string | null;
  matched_listing_id: string | null;
  resolved_at: string | null;
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
  paused: number;
  resolved: number;
  archived: number;
  inconsistent: number;
};

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
  let paused = 0;
  let resolved = 0;
  let inconsistent = 0;

  for (const demand of demands) {
    const need = needByDemandId.get(demand.id) || null;
    const alertsEnabled = enabledDemandIds.has(demand.id);
    const demandActive = demand.status === "open" || demand.status === "matched";
    const demandResolved = Boolean(demand.resolved_at || demand.confirmed_agreement_id);

    if (demand.first_result_at || demand.matched_listing_id) withResult += 1;
    if (demandResolved) resolved += 1;

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
    paused,
    resolved,
    archived: needs.filter((need) => need.status === "archived").length,
    inconsistent,
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
        .select("id,status,first_result_at,matched_listing_id,resolved_at,confirmed_agreement_id")
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
