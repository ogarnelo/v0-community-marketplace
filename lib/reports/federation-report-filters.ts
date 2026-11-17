import { requireRepresentedSchool } from "./federation-reporting-scope";

export type FederationPeriod = "90d" | "365d" | "total";
export type FederationReportFilter = {
  period: FederationPeriod;
  schoolIds: readonly string[];
  start: string | null;
  end: string;
};
/**
 * Server-side allowlist for future reporting reads.
 * The client cannot supply arbitrary date ranges, unbounded list sizes,
 * schools outside verified representation or a made-up ALL fallback.
 */
export function parseFederationReportFilter(input:{
  period: unknown;
  schoolId: unknown;
  allowedSchoolIds: readonly string[];
  now: Date;
}): FederationReportFilter {
  if (!(input.now instanceof Date) || !Number.isFinite(input.now.getTime()))
    throw new Error("INVALID_REPORT_TIME");
  const period=input.period === undefined ? "365d" : input.period;
  if (period !== "90d" && period !== "365d" && period !== "total")
    throw new Error("INVALID_REPORT_PERIOD");
  const allowed=input.allowedSchoolIds;
  if (!Array.isArray(allowed) || allowed.length===0 || allowed.length>500 ||
      new Set(allowed.map(x=>x.toLowerCase())).size!==allowed.length)
    throw new Error("INVALID_REPORT_SCOPE");
  let schoolIds: string[];
  if (input.schoolId === undefined || input.schoolId===null) {
    schoolIds=[...allowed];
  } else {
    if (typeof input.schoolId!=="string") throw new Error("INVALID_REPORT_SCHOOL");
    schoolIds=[requireRepresentedSchool(allowed,input.schoolId)];
  }
  const end=input.now.toISOString();
  const start=period==="total"?null:new Date(input.now.getTime() -
      (period==="90d"?90:365)*86400000).toISOString();
  return {period,schoolIds:schoolIds.map(x=>x.toLowerCase()).sort(),start,end};
}
