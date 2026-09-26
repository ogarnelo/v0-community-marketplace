import "server-only";

import { createHash } from "node:crypto";
import { extractIsbnFromText, normalizeIsbn } from "@/lib/books/isbn";

type ExplicitDemand = {
  source: "saved_search" | "demand_request";
  sourceId: string;
  userId: string | null;
  title: string;
  query: string | null;
  isbn: string | null;
  category: string | null;
  gradeLevel: string | null;
  schoolId: string | null;
  specificType: string | null;
  sizeLabel: string | null;
  brand: string | null;
  model: string | null;
  createdAt: string;
};

export type DemandOpportunity = {
  key: string;
  title: string;
  schoolId: string | null;
  schoolName: string | null;
  category: string | null;
  gradeLevel: string | null;
  isbn: string | null;
  specificType: string | null;
  sizeLabel: string | null;
  brand: string | null;
  model: string | null;
  familiesCount: number;
  searchesCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  supplyCount: number;
  status: "new" | "offer_search" | "sellers_contacted" | "supply_generated" | "satisfied" | "closed";
  demandUserIds: string[];
  sourceIds: string[];
  identity: string;
};

export type SupplyCandidate = {
  userId: string;
  name: string;
  score: number;
  affinity: "alta" | "media";
  reasons: string[];
  lastListingAt: string | null;
};

const STOPWORDS = new Set([
  "de","del","la","el","los","las","un","una","para","por","en","y","o",
  "colegio","centro","escuela","uniforme","uniformes","talla","curso","material",
  "busco","necesito","quiero","escolar","escolares"
]);

function normalizeText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function queryTokens(value: string | null, schoolName: string | null, category: string | null) {
  const schoolTokens = new Set(normalizeText(schoolName).split(" ").filter((token) => token.length > 1));
  const categoryTokens = new Set(normalizeText(category).split(" ").filter((token) => token.length > 1));
  return Array.from(
    new Set(
      normalizeText(value)
        .split(" ")
        .filter((token) =>
          token.length > 1 &&
          !STOPWORDS.has(token) &&
          !schoolTokens.has(token) &&
          !categoryTokens.has(token)
        )
    )
  ).sort();
}

function stableKey(identity: string) {
  return `opp_${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`;
}

function metadataText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildIdentity(demand: ExplicitDemand, schoolName: string | null) {
  const canonical =
    (demand.isbn ? normalizeIsbn(demand.isbn)?.canonicalIsbn || null : null) ||
    extractIsbnFromText([demand.query, demand.title].filter(Boolean).join(" "))?.canonicalIsbn ||
    null;
  if (canonical) {
    return {
      identity: `isbn:${canonical}|school:${demand.schoolId || "*"}`,
      canonicalIsbn: canonical,
    };
  }

  const tokens = queryTokens(demand.query || demand.title, schoolName, demand.category);
  const identity = [
    `school:${demand.schoolId || "*"}`,
    `category:${normalizeText(demand.category) || "*"}`,
    `grade:${normalizeText(demand.gradeLevel) || "*"}`,
    `specific:${normalizeText(demand.specificType) || "*"}`,
    `size:${normalizeText(demand.sizeLabel) || "*"}`,
    `brand:${normalizeText(demand.brand) || "*"}`,
    `model:${normalizeText(demand.model) || "*"}`,
    `tokens:${tokens.join(",") || normalizeText(demand.title)}`,
  ].join("|");

  return { identity, canonicalIsbn: null };
}

function listingSearchText(listing: any) {
  return normalizeText([
    listing.title,
    listing.description,
    listing.isbn,
    listing.subject,
    listing.specific_type,
    listing.size_label,
    listing.brand,
    listing.model,
  ].filter(Boolean).join(" "));
}

function groupMatchesEvent(opportunity: DemandOpportunity, event: any, schoolName: string | null) {
  if ((event.results_count ?? event.result_count ?? 0) !== 0) return false;
  const eventDemand: ExplicitDemand = {
    source: "saved_search",
    sourceId: String(event.id || ""),
    userId: event.user_id || null,
    title: event.query || event.isbn_query || event.category || "Demanda",
    query: event.query || null,
    isbn: event.isbn_query || event.isbn || null,
    category: event.category || null,
    gradeLevel: event.grade_level || null,
    schoolId: event.school_id || null,
    specificType: metadataText(event.metadata?.specific_type),
    sizeLabel: metadataText(event.metadata?.size_label),
    brand: metadataText(event.metadata?.brand),
    model: metadataText(event.metadata?.model),
    createdAt: event.created_at,
  };
  return buildIdentity(eventDemand, schoolName).identity === opportunity.identity;
}

function supplyMatches(opportunity: DemandOpportunity, listing: any) {
  if (listing.status !== "available") return false;
  if (opportunity.isbn) {
    return normalizeIsbn(listing.isbn || "")?.canonicalIsbn === opportunity.isbn;
  }
  if (opportunity.schoolId && listing.school_id !== opportunity.schoolId) return false;
  if (opportunity.category && normalizeText(listing.category) !== normalizeText(opportunity.category)) return false;
  if (opportunity.gradeLevel && listing.grade_level && normalizeText(listing.grade_level) !== normalizeText(opportunity.gradeLevel)) return false;

  const tokens = queryTokens(opportunity.title, opportunity.schoolName, opportunity.category);
  if (tokens.length === 0) return true;
  const haystack = listingSearchText(listing);
  return tokens.some((token) => haystack.includes(token));
}

export async function loadDemandOpportunities(admin: any): Promise<DemandOpportunity[]> {
  const [
    { data: savedSearches },
    { data: demandRequests },
    { data: events },
    { data: listings },
    { data: schools },
    { data: campaigns },
  ] = await Promise.all([
    admin
      .from("saved_searches")
      .select("id,user_id,query,isbn_query,category,grade_level,school_id,need_details,results_count,intent_source,created_at")
      .eq("results_count", 0)
      .eq("intent_source", "zero_results_prompt")
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("demand_requests")
      .select("id,user_id,title,normalized_query,category,grade_level,isbn,school_id,status,metadata,created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("marketplace_search_events")
      .select("id,user_id,query,isbn_query,category,grade_level,results_count,school_id,created_at")
      .eq("results_count", 0)
      .order("created_at", { ascending: false })
      .limit(3000),
    admin
      .from("listings")
      .select("id,seller_id,title,description,isbn,category,grade_level,status,school_id,listing_type,type,subject,specific_type,size_label,brand,model,created_at")
      .limit(5000),
    admin.from("schools").select("id,name"),
    admin
      .from("demand_campaigns")
      .select("opportunity_key,status")
      .limit(2000),
  ]);

  const schoolNames = new Map((schools || []).map((school: any) => [school.id, school.name]));
  const statusByKey = new Map((campaigns || []).map((campaign: any) => [campaign.opportunity_key, campaign.status]));
  const explicit: ExplicitDemand[] = [];

  for (const row of savedSearches || []) {
    explicit.push({
      source: "saved_search",
      sourceId: row.id,
      userId: row.user_id || null,
      title: row.need_details || row.query || row.isbn_query || row.category || row.grade_level || "Demanda sin detalle",
      query: row.need_details || row.query || null,
      isbn: row.isbn_query || null,
      category: row.category || null,
      gradeLevel: row.grade_level || null,
      schoolId: row.school_id || null,
      specificType: null,
      sizeLabel: null,
      brand: null,
      model: null,
      createdAt: row.created_at,
    });
  }

  for (const row of demandRequests || []) {
    explicit.push({
      source: "demand_request",
      sourceId: row.id,
      userId: row.user_id || null,
      title: row.title,
      query: row.normalized_query || row.title,
      isbn: row.isbn || null,
      category: row.category || null,
      gradeLevel: row.grade_level || null,
      schoolId: row.school_id || null,
      specificType: metadataText(row.metadata?.specific_type),
      sizeLabel: metadataText(row.metadata?.size_label),
      brand: metadataText(row.metadata?.brand),
      model: metadataText(row.metadata?.model),
      createdAt: row.created_at,
    });
  }

  const grouped = new Map<string, {
    identity: string;
    key: string;
    title: string;
    schoolId: string | null;
    category: string | null;
    gradeLevel: string | null;
    isbn: string | null;
    specificType: string | null;
    sizeLabel: string | null;
    brand: string | null;
    model: string | null;
    users: Set<string>;
    sourceIds: string[];
    firstSeenAt: string;
    lastSeenAt: string;
  }>();

  for (const demand of explicit) {
    const schoolName = demand.schoolId ? schoolNames.get(demand.schoolId) || null : null;
    const { identity, canonicalIsbn } = buildIdentity(demand, schoolName);
    const key = stableKey(identity);
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        identity,
        key,
        title: demand.title,
        schoolId: demand.schoolId,
        category: demand.category,
        gradeLevel: demand.gradeLevel,
        isbn: canonicalIsbn,
        specificType: demand.specificType,
        sizeLabel: demand.sizeLabel,
        brand: demand.brand,
        model: demand.model,
        users: new Set(demand.userId ? [demand.userId] : []),
        sourceIds: [demand.sourceId],
        firstSeenAt: demand.createdAt,
        lastSeenAt: demand.createdAt,
      });
      continue;
    }

    if (demand.userId) current.users.add(demand.userId);
    current.sourceIds.push(demand.sourceId);
    if (new Date(demand.createdAt).getTime() < new Date(current.firstSeenAt).getTime()) current.firstSeenAt = demand.createdAt;
    if (new Date(demand.createdAt).getTime() > new Date(current.lastSeenAt).getTime()) {
      current.lastSeenAt = demand.createdAt;
      current.title = demand.title;
    }
  }

  const opportunities: DemandOpportunity[] = Array.from(grouped.values()).map((group) => {
    const schoolName = group.schoolId ? schoolNames.get(group.schoolId) || null : null;
    const base: DemandOpportunity = {
      key: group.key,
      identity: group.identity,
      title: group.title,
      schoolId: group.schoolId,
      schoolName,
      category: group.category,
      gradeLevel: group.gradeLevel,
      isbn: group.isbn,
      specificType: group.specificType,
      sizeLabel: group.sizeLabel,
      brand: group.brand,
      model: group.model,
      familiesCount: group.users.size,
      searchesCount: 0,
      firstSeenAt: group.firstSeenAt,
      lastSeenAt: group.lastSeenAt,
      supplyCount: 0,
      status: (statusByKey.get(group.key) as DemandOpportunity["status"]) || "new",
      demandUserIds: Array.from(group.users),
      sourceIds: group.sourceIds,
    };

    const matchingSearchEvents = (events || []).filter((event: any) => groupMatchesEvent(base, event, schoolName)).length;
    base.searchesCount = matchingSearchEvents > 0 ? matchingSearchEvents : group.sourceIds.length;
    base.supplyCount = (listings || []).filter((listing: any) => supplyMatches(base, listing)).length;
    return base;
  });

  return opportunities.sort((a, b) => {
    const zeroSupplyDelta = Number(a.supplyCount > 0) - Number(b.supplyCount > 0);
    if (zeroSupplyDelta !== 0) return zeroSupplyDelta;
    if (b.familiesCount !== a.familiesCount) return b.familiesCount - a.familiesCount;
    return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
  });
}

export async function findDemandOpportunity(admin: any, key: string) {
  const opportunities = await loadDemandOpportunities(admin);
  return opportunities.find((opportunity) => opportunity.key === key) || null;
}

export async function findSupplyCandidates(admin: any, opportunity: DemandOpportunity): Promise<SupplyCandidate[]> {
  const [{ data: listings }, { data: profiles }, { data: recentActions }, { data: unresolvedReports }] = await Promise.all([
    admin
      .from("listings")
      .select("id,seller_id,title,isbn,category,grade_level,status,school_id,listing_type,type,specific_type,size_label,brand,model,created_at")
      .not("seller_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(5000),
    admin
      .from("profiles")
      .select("id,full_name,business_name,user_type")
      .limit(5000),
    admin
      .from("demand_opportunity_actions")
      .select("target_user_id,created_at")
      .eq("opportunity_key", opportunity.key)
      .eq("action_type", "seller_contacted")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1000),
    admin
      .from("reports")
      .select("listing_id,status")
      .not("listing_id", "is", null)
      .neq("status", "resolved")
      .limit(2000),
  ]);

  const profileById = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
  const recentlyContacted = new Set((recentActions || []).map((action: any) => action.target_user_id).filter(Boolean));
  const reportedListingIds = new Set((unresolvedReports || []).map((report: any) => report.listing_id).filter(Boolean));
  const sellersWithUnresolvedListingReports = new Set(
    (listings || [])
      .filter((listing: any) => reportedListingIds.has(listing.id))
      .map((listing: any) => listing.seller_id)
      .filter(Boolean)
  );
  const demanders = new Set(opportunity.demandUserIds);
  const bySeller = new Map<string, any[]>();

  for (const listing of listings || []) {
    const sellerId = listing.seller_id;
    if (!sellerId || demanders.has(sellerId) || recentlyContacted.has(sellerId) || sellersWithUnresolvedListingReports.has(sellerId)) continue;
    const profile = profileById.get(sellerId);
    if (!profile || profile.user_type === "student") continue;

    const sameIsbn = Boolean(
      opportunity.isbn &&
      normalizeIsbn(listing.isbn || "")?.canonicalIsbn === opportunity.isbn
    );
    const sameSchoolCategory = Boolean(
      opportunity.schoolId &&
      listing.school_id === opportunity.schoolId &&
      opportunity.category &&
      normalizeText(listing.category) === normalizeText(opportunity.category)
    );
    if (!sameIsbn && !sameSchoolCategory) continue;

    const current = bySeller.get(sellerId) || [];
    current.push(listing);
    bySeller.set(sellerId, current);
  }

  const candidates: SupplyCandidate[] = [];

  for (const [sellerId, sellerListings] of bySeller.entries()) {
    let score = 0;
    const reasons = new Set<string>();

    for (const listing of sellerListings) {
      const sameIsbn = Boolean(
        opportunity.isbn &&
        normalizeIsbn(listing.isbn || "")?.canonicalIsbn === opportunity.isbn
      );
      if (sameIsbn) {
        score = Math.max(score, 100);
        reasons.add("Publicó anteriormente este mismo ISBN");
      }

      const sameSchoolCategory = Boolean(
        opportunity.schoolId &&
        listing.school_id === opportunity.schoolId &&
        opportunity.category &&
        normalizeText(listing.category) === normalizeText(opportunity.category)
      );
      if (sameSchoolCategory) {
        score = Math.max(score, 40);
        reasons.add("Publicó material de la misma categoría en este centro");
      }

      if (opportunity.sizeLabel && normalizeText(listing.size_label) === normalizeText(opportunity.sizeLabel)) {
        score += 15;
        reasons.add(`Coincide la talla ${opportunity.sizeLabel}`);
      }
      if (opportunity.specificType && normalizeText(listing.specific_type) === normalizeText(opportunity.specificType)) {
        score += 15;
        reasons.add("Coincide el tipo de material");
      }
      if (opportunity.brand && normalizeText(listing.brand) === normalizeText(opportunity.brand)) {
        score += 10;
        reasons.add("Coincide la marca");
      }
      if (opportunity.model && normalizeText(listing.model) === normalizeText(opportunity.model)) {
        score += 10;
        reasons.add("Coincide el modelo");
      }
      if (listing.status === "available") {
        score += 10;
        reasons.add("Tiene material relacionado publicado actualmente");
      } else if (listing.status === "sold" || listing.type === "donation" || listing.listing_type === "donation") {
        score += 5;
        reasons.add("Ha vendido o donado material relacionado");
      }
    }

    const profile = profileById.get(sellerId);
    const lastListingAt = sellerListings[0]?.created_at || null;
    if (lastListingAt) {
      const months = Math.max(0, Math.round((Date.now() - new Date(lastListingAt).getTime()) / (30 * 24 * 60 * 60 * 1000)));
      reasons.add(months === 0 ? "Publicó material relacionado recientemente" : `Última publicación relacionada hace ~${months} meses`);
    }

    if (score < 40) continue;
    candidates.push({
      userId: sellerId,
      name: profile?.business_name || profile?.full_name || "Usuario",
      score,
      affinity: score >= 70 ? "alta" : "media",
      reasons: Array.from(reasons),
      lastListingAt,
    });
  }

  return candidates.sort((a, b) => b.score - a.score || String(b.lastListingAt || "").localeCompare(String(a.lastListingAt || "")));
}

export function activationMessage(opportunity: DemandOpportunity) {
  const count = opportunity.familiesCount;
  const center = opportunity.schoolName ? ` de ${opportunity.schoolName}` : "";
  const course = opportunity.gradeLevel ? ` (${opportunity.gradeLevel})` : "";
  return `Hay ${count} ${count === 1 ? "familia buscando" : "familias buscando"} ${opportunity.title}${center}${course}. ¿Tienes alguno que ya no uses?`;
}

export function opportunityMetadata(opportunity: DemandOpportunity) {
  return {
    title: opportunity.title,
    school_id: opportunity.schoolId,
    school_name: opportunity.schoolName,
    category: opportunity.category,
    grade_level: opportunity.gradeLevel,
    isbn: opportunity.isbn,
    specific_type: opportunity.specificType,
    size_label: opportunity.sizeLabel,
    brand: opportunity.brand,
    model: opportunity.model,
    families_count: opportunity.familiesCount,
    searches_count: opportunity.searchesCount,
    supply_count: opportunity.supplyCount,
    first_seen_at: opportunity.firstSeenAt,
    last_seen_at: opportunity.lastSeenAt,
    source_ids: opportunity.sourceIds,
    demand_user_ids: opportunity.demandUserIds,
    identity: opportunity.identity,
  };
}
