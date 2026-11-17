/**
 * Limited KPI projection for federated reporting.
 * No raw users, messages, offers, moderation reports or payment records.
 * Input MUST be calculated server-side after resolving representation access.
 * This is a pure projection, not an endpoint or authorization decision.
 */
export type RawSchoolKpi = {
  schoolId: string;
  schoolName: string;
  reusedItems: number;
  donatedItems: number;
  soldItems: number;
  circularValue: number;
  estimatedAvoidedCo2: number;
  activeListings: number;
  listingViews: number;
  members: number;
};
export type PublicKpi = {
  reusedItems: number;
  donatedItems: number;
  soldItems: number;
  circularValue: number;
  estimatedAvoidedCo2: number;
  activeListings: number;
  listingViews: number;
};
export type SchoolKpiView = {
  schoolId: string;
  schoolName: string;
  metrics: PublicKpi | null;
  suppressed: boolean;
};
const COUNT_KEYS = ["reusedItems","donatedItems","soldItems","activeListings","listingViews"] as const;
const VALUE_KEYS = ["circularValue","estimatedAvoidedCo2"] as const;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validate(row: RawSchoolKpi): boolean {
  if(!UUID.test(row.schoolId) || typeof row.schoolName !== "string" ||
     row.schoolName.trim().length===0 || row.schoolName.length>200) return false;
  if (!Number.isSafeInteger(row.members) || row.members<0) return false;
  for(const key of COUNT_KEYS) {
    if(!Number.isSafeInteger(row[key]) || row[key]<0) return false;
  }
  for(const key of VALUE_KEYS) {
    if(!Number.isFinite(row[key]) || row[key]<0) return false;
  }
  return true;
}
function metrics(row:RawSchoolKpi):PublicKpi {
  return {
    reusedItems:row.reusedItems,donatedItems:row.donatedItems,
    soldItems:row.soldItems,circularValue:row.circularValue,
    estimatedAvoidedCo2:row.estimatedAvoidedCo2,
    activeListings:row.activeListings,listingViews:row.listingViews,
  };
}
/** Conservative provisional 10-member threshold. Legal/product signoff pending. */
export const MIN_REPORTING_MEMBERS = 10;
export function projectFederationSchoolKpis(
  rows:readonly RawSchoolKpi[],
  allowedSchoolIds:readonly string[]
):readonly SchoolKpiView[] {
  const allowed=new Set(allowedSchoolIds.map(x=>x.toLowerCase()));
  const output:SchoolKpiView[]=[];
  const seen=new Set<string>();
  for(const row of rows) {
    if(!validate(row)) throw new Error("INVALID_REPORTING_METRIC");
    const id=row.schoolId.toLowerCase();
    if(!allowed.has(id)) throw new Error("FEDERATION_REPORT_SCOPE_DENIED");
    if(seen.has(id)) throw new Error("DUPLICATE_SCHOOL_METRICS");
    seen.add(id);
    const suppressed=row.members<MIN_REPORTING_MEMBERS;
    output.push({schoolId:id,schoolName:row.schoolName,
      metrics:suppressed?null:metrics(row),suppressed});
  }
  return output.sort((a,b)=>a.schoolId.localeCompare(b.schoolId));
}
/**
 * Conservative suppression: if ANY represented school has <10 members,
 * federation totals are withheld to avoid differencing attacks from school
 * filters. Do not treat absent schools as zero.
 */
export function sumFederationKpis(
  views:readonly SchoolKpiView[], expectedSchoolIds:readonly string[]
):PublicKpi | null {
  const expected=new Set(expectedSchoolIds.map(x=>x.toLowerCase()));
  if(expected.size===0 || views.length!==expected.size ||
     views.some(x=>!expected.has(x.schoolId) || x.suppressed || !x.metrics)) return null;
  const zero:PublicKpi={reusedItems:0,donatedItems:0,soldItems:0,circularValue:0,
    estimatedAvoidedCo2:0,activeListings:0,listingViews:0};
  for(const view of views){
    const m=view.metrics!;
    for(const key of [...COUNT_KEYS,...VALUE_KEYS]) zero[key]+=m[key];
  }
  return zero;
}
