export type AcquisitionEvent = {
  event_type: string;
  user_id: string | null;
  source: string;
  medium: string | null;
  campaign: string | null;
  created_at: string;
};

export type AcquisitionSummary = {
  source: string;
  medium: string;
  campaign: string;
  landings: number;
  users: number;
  listings: number;
  agreements: number;
  schoolJoins: number;
  lastSeenAt: string | null;
};

export function buildAcquisitionSummaries(events: AcquisitionEvent[]) {
  const map = new Map<string, AcquisitionSummary>();

  for (const event of events) {
    const source = event.source?.trim() || "unknown";
    const medium = event.medium?.trim() || "sin medio";
    const campaign = event.campaign?.trim() || "sin campaña";
    const key = `${source.toLowerCase()}|${medium.toLowerCase()}|${campaign.toLowerCase()}`;
    const current =
      map.get(key) ||
      {
        source,
        medium,
        campaign,
        landings: 0,
        users: 0,
        listings: 0,
        agreements: 0,
        schoolJoins: 0,
        lastSeenAt: null,
      };

    if (event.event_type === "landing") current.landings += 1;
    if (event.event_type === "attributed_user") current.users += 1;
    if (event.event_type === "listing_published") current.listings += 1;
    if (event.event_type === "agreement_confirmed") current.agreements += 1;
    if (event.event_type === "school_joined") current.schoolJoins += 1;

    if (
      event.created_at &&
      (!current.lastSeenAt || new Date(event.created_at) > new Date(current.lastSeenAt))
    ) {
      current.lastSeenAt = event.created_at;
    }

    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.users !== a.users) return b.users - a.users;
    if (b.agreements !== a.agreements) return b.agreements - a.agreements;
    return b.landings - a.landings;
  });
}
