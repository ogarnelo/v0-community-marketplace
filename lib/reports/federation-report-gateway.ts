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
}):Promise<FederationReportResult> {
  const scope=resolveHierarchySchoolScope(input.authority);
  if(scope.length===0)throw new Error("FEDERATION_REPORT_SCOPE_DENIED");
  if(typeof input.loadAuthorizedSchools!=="function")
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
  const views=projectFederationSchoolKpis(rows,scope);
  if(views.length!==scope.length)throw new Error("INCOMPLETE_REPORTING_METRICS");
  const total=sumFederationKpis(views,scope);
  const selected=new Set(filter.schoolIds);
  return {period:filter.period,start:filter.start,end:filter.end,
    schools:views.filter(x=>selected.has(x.schoolId)),
    total,totalSuppressed:total===null};
}
