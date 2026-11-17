/**
 * Adapts WETUDY's EXISTING school impact reports into the strictly limited
 * federation KPI shape. No service-role or database client is created here:
 * a future server route must first authorize the federation scope, then inject
 * the existing report loader and a fresh active-school verifier.
 *
 * This is NOT a public endpoint. Do not use with client-supplied school IDs.
 */
import type { SchoolImpactReport } from "./school-impact-report";
import type { RawSchoolKpi } from "./federation-kpi-projection";

type ReportRequest = {
  schoolId: string;
  start: Date | null;
  end: Date;
  periodLabel: string;
  periodKey: string;
};
export type FederationSchoolKpiDependencies = {
  loadSchoolImpact: (request: ReportRequest) => Promise<SchoolImpactReport>;
  verifySchoolStillActive: (schoolId: string) => Promise<boolean>;
};
type AuthorizedScope = {
  schoolIds: readonly string[];
  start: string | null;
  end: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
/**
 * No unbounded fan-out into multiple privileged reads. A future paginated
 * aggregate source is needed before enabling large federation reporting.
 */
export const FEDERATION_SCHOOL_REPORT_LIMIT = 25;

export function createFederationSchoolKpiLoader(deps: FederationSchoolKpiDependencies) {
  if(typeof deps.loadSchoolImpact !== "function" ||
     typeof deps.verifySchoolStillActive !== "function")
    throw new Error("FEDERATION_KPI_DEPENDENCIES_UNAVAILABLE");
  return async (scope: AuthorizedScope): Promise<readonly RawSchoolKpi[]> => {
    if(!Array.isArray(scope.schoolIds) ||
       scope.schoolIds.length===0 || scope.schoolIds.length>FEDERATION_SCHOOL_REPORT_LIMIT ||
       scope.schoolIds.some(id=>typeof id!=="string" || !UUID.test(id)) ||
       new Set(scope.schoolIds.map(id=>id.toLowerCase())).size!==scope.schoolIds.length)
      throw new Error("INVALID_FEDERATION_KPI_SCOPE");
    if(typeof scope.end!=="string" || !ISO.test(scope.end) ||
       (scope.start!==null && (typeof scope.start!=="string" || !ISO.test(scope.start))))
      throw new Error("INVALID_FEDERATION_KPI_PERIOD");
    const end = new Date(scope.end);
    const start = scope.start===null?null:new Date(scope.start);
    if(!Number.isFinite(end.getTime()) || (start!==null &&
       (!Number.isFinite(start.getTime()) || start>=end)))
      throw new Error("INVALID_FEDERATION_KPI_PERIOD");

    const periodKey = start===null?"historico":"federacion";
    const output: RawSchoolKpi[] = [];
    for(const schoolId of scope.schoolIds){
      const id=schoolId.toLowerCase();
      const report=await deps.loadSchoolImpact({
        schoolId:id,start,end,periodLabel:"Periodo autorizado",periodKey,
      });
      if(!report || report.school?.id?.toLowerCase()!==id ||
         report.school?.is_active!==true)
        throw new Error("FEDERATION_SCHOOL_INACTIVE_OR_MISMATCH");
      // The school could have been deactivated after the initial data read.
      // Confirm activity again before projecting any aggregate metrics.
      if(await deps.verifySchoolStillActive(id)!==true)
        throw new Error("FEDERATION_SCHOOL_INACTIVE_OR_MISMATCH");
      output.push({
        schoolId:id,schoolName:report.school.name,
        reusedItems:report.reusedItems,donatedItems:report.donatedItems,
        soldItems:report.soldItems,circularValue:report.circularValue,
        estimatedAvoidedCo2:report.estimatedAvoidedCo2,
        activeListings:report.activeListings,listingViews:report.listingViews,
        members:report.members,
      });
    }
    return output;
  };
}
