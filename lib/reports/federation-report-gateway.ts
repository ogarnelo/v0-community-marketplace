/**
 * Server-only composition boundary for a future federation dashboard.
 *
 * ATTENTION: Callers must provide trusted backend membership, representation,
 * graph and aggregate loaders. No production federation schema/role exists yet.
 * Fetches the FULL authorized scope before applying display filters so one
 * omitted/suppressed school cannot be inferred by subtracting filtered totals.
 */
import {resolveHierarchySchoolScope, type FederationHierarchyInput} from "./federation-reporting-hierarchy";
import {parseFederationReportFilter, type FederationPeriod} from "./federation-report-filters";
import {projectFederationSchoolKpis, sumFederationKpis,
  type RawSchoolKpi, type SchoolKpiView, type PublicKpi} from "./federation-kpi-projection";

export type FederationReportResult = {
  period: FederationPeriod;
  start: string | null;
  end: string;
  schools: readonly SchoolKpiView[];
  total: PublicKpi | null;
  totalSuppressed: boolean;
};
/**
 * Compare the entire effective representation snapshot, not merely the set
 * of visible school IDs. Two different legal paths may expose the SAME school
 * set; a mid-request revoked link or changed verification must still abort.
 * Timestamp `now` is deliberately excluded: it must advance normally.
 */
function authoritySignature(input: FederationHierarchyInput): string {
  const memberships=input.memberships.map(m=>[
    m.userId,m.federationId,m.role,m.state,
  ].join("|")).sort();
  const links=input.links.map(x=>[
    x.parentId,x.childId,x.status,x.startsAt,x.endsAt,
  ].join("|")).sort();
  const representations=input.representations.map(x=>[
    x.federationId,x.schoolId,x.state,x.startsAt,x.endsAt,
  ].join("|")).sort();
  return JSON.stringify({
    userId:input.userId,rootFederationId:input.rootFederationId,
    memberships,links,representations,
  });
}

type TrustedSchoolMetricsLoader = (scope: {
  schoolIds: readonly string[];
  start: string | null;
  end: string;
}) => Promise<readonly RawSchoolKpi[]>;

export async function createFederationReport(input: {
  authority: FederationHierarchyInput;
  requestedPeriod: unknown;
  requestedSchoolId: unknown;
  loadAuthorizedSchools: TrustedSchoolMetricsLoader;
  /** MUST freshly reload membership + complete representation, uncached. */
  reloadAuthority: () => Promise<FederationHierarchyInput>;
}):Promise<FederationReportResult> {
  const scope=resolveHierarchySchoolScope(input.authority);
  if(scope.length===0)throw new Error("FEDERATION_REPORT_SCOPE_DENIED");
  if(typeof input.loadAuthorizedSchools!=="function" ||
     typeof input.reloadAuthority!=="function")
    throw new Error("REPORT_LOADER_UNAVAILABLE");
  const filter=parseFederationReportFilter({
    period:input.requestedPeriod,schoolId:input.requestedSchoolId,
    allowedSchoolIds:scope,now:input.authority.now,
  });
  // Query full scope EVEN if a single school is displayed. Never fetch data
  // from a client-supplied school ID; the set comes from backend authorization.
  const rows=await input.loadAuthorizedSchools({
    schoolIds:scope,start:filter.start,end:filter.end,
  });
  if(!Array.isArray(rows))throw new Error("INVALID_REPORTING_METRICS");
  // Representation or membership may be revoked while privileged metrics are
  // being calculated. Re-read a FRESH server-trusted snapshot immediately
  // before releasing any result; reject all drift, not just lost schools.
  const fresh=await input.reloadAuthority();
  if(!fresh || fresh.userId!==input.authority.userId ||
     fresh.rootFederationId!==input.authority.rootFederationId ||
     !(fresh.now instanceof Date) ||
     fresh.now.getTime()<input.authority.now.getTime())
    throw new Error("FEDERATION_REPORT_SCOPE_CHANGED");
  const verified=resolveHierarchySchoolScope(fresh);
  if(verified.length!==scope.length || verified.some((id,i)=>id!==scope[i]) ||
     authoritySignature(fresh)!==authoritySignature(input.authority))
    throw new Error("FEDERATION_REPORT_SCOPE_CHANGED");
  const views=projectFederationSchoolKpis(rows,scope);
  if(views.length!==scope.length)throw new Error("INCOMPLETE_REPORTING_METRICS");
  const total=sumFederationKpis(views,scope);
  const selected=new Set(filter.schoolIds);
  return {period:filter.period,start:filter.start,end:filter.end,
    schools:views.filter(x=>selected.has(x.schoolId)),
    total,totalSuppressed:total===null};
}
