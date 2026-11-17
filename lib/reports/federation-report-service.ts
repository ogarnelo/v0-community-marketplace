/**
 * Internal, non-routable orchestration for a future federation-report API.
 * No live federation tables, memberships, routes or permissions exist yet.
 *
 * Callers MUST pass an authenticated user ID obtained from a trusted server
 * session and UN-CACHED database reads for all seven source collections.
 * This service cannot be exposed directly to a browser or client JWT.
 */
import "server-only";

import {buildFederationAuthoritySnapshot,
  type TrustedFederationSnapshot} from "./federation-authority-snapshot";
import {createFederationReport,
  type FederationReportResult} from "./federation-report-gateway";
import {createFederationSchoolKpiLoader,
  type FederationSchoolKpiDependencies} from "./federation-school-kpi-adapter";

export type TrustedFederationReportDependencies = FederationSchoolKpiDependencies & {
  loadCompleteAuthoritySnapshot: () => Promise<TrustedFederationSnapshot>;
  serverNow: () => Date;
};
export async function loadVerifiedFederationReport(input:{
  authenticatedUserId:string;
  federationId:string;
  period:unknown;
  schoolId:unknown;
  dependencies:TrustedFederationReportDependencies;
}):Promise<FederationReportResult>{
  const deps=input.dependencies;
  if(!deps || typeof deps.loadCompleteAuthoritySnapshot!=="function" ||
     typeof deps.serverNow!=="function")throw Error("FEDERATION_REPORT_BACKEND_UNAVAILABLE");
  // Read the full, trusted representation snapshot once before privileged KPI
  // access, and again after loading the whole set to detect mid-request
  // revocations. Neither read can use a cached or partial response.
  const first=await deps.loadCompleteAuthoritySnapshot();
  const authority=buildFederationAuthoritySnapshot({
    userId:input.authenticatedUserId,
    rootFederationId:input.federationId,
    now:deps.serverNow(),
    snapshot:first,
  });
  const schoolLoader=createFederationSchoolKpiLoader(deps);
  return createFederationReport({
    authority,
    requestedPeriod:input.period,
    requestedSchoolId:input.schoolId,
    loadAuthorizedSchools:schoolLoader,
    reloadAuthority:async()=>buildFederationAuthoritySnapshot({
      userId:input.authenticatedUserId,
      rootFederationId:input.federationId,
      now:deps.serverNow(),
      snapshot:await deps.loadCompleteAuthoritySnapshot(),
    }),
  });
}
