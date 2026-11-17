/**
 * Presentation-only projection of already-authorized federation reporting.
 * Never resolve roles, query tables or accept a list of client school IDs here.
 * Authenticated server code must call loadVerifiedFederationReport first.
 */
import type { FederationReportResult } from "./federation-report-gateway";
import type { PublicKpi } from "./federation-kpi-projection";

export type FederationDashboardMetric = {
  key: keyof PublicKpi;
  title: string;
  value: number;
  unit: "count" | "eur" | "kg";
};
export type FederationDashboardSchool = {
  id: string;
  name: string;
  suppressed: boolean;
  metrics: readonly FederationDashboardMetric[] | null;
};
export type FederationDashboardModel = {
  organization: string;
  period: FederationReportResult["period"];
  periodLabel: string;
  start: string | null;
  end: string;
  schools: readonly FederationDashboardSchool[];
  total: readonly FederationDashboardMetric[] | null;
  totalSuppressed: boolean;
};
const METRICS: readonly {
  key: keyof PublicKpi;
  title: string;
  unit: FederationDashboardMetric["unit"];
}[] = [
  {key:"reusedItems",title:"Artículos reutilizados",unit:"count"},
  {key:"donatedItems",title:"Donaciones",unit:"count"},
  {key:"soldItems",title:"Compraventas",unit:"count"},
  {key:"circularValue",title:"Valor circular",unit:"eur"},
  {key:"estimatedAvoidedCo2",title:"CO₂ evitado (estimado)",unit:"kg"},
  {key:"activeListings",title:"Anuncios activos",unit:"count"},
  {key:"listingViews",title:"Visualizaciones",unit:"count"},
];
const COUNT=new Set<keyof PublicKpi>([
  "reusedItems","donatedItems","soldItems","activeListings","listingViews",
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function project(metrics:PublicKpi):readonly FederationDashboardMetric[]{
  return METRICS.map(({key,title,unit})=>{
    const value=metrics[key];
    if(typeof value!=="number" || !Number.isFinite(value) || value<0 ||
      (COUNT.has(key) && !Number.isSafeInteger(value)))
      throw Error("INVALID_FEDERATION_DISPLAY_METRIC");
    return {key,title,value,unit};
  });
}
export function buildFederationDashboardModel(input:{
  report:FederationReportResult;
  organization:string;
}):FederationDashboardModel{
  const {report}=input;
  const organization=input.organization?.trim();
  if(!organization || organization.length>200 ||
    !report || !Array.isArray(report.schools) ||
    !["90d","365d","total"].includes(report.period) ||
    typeof report.end!=="string" || !Number.isFinite(Date.parse(report.end)) ||
    (report.start!==null && (typeof report.start!=="string" ||
      !Number.isFinite(Date.parse(report.start)))))
    throw Error("INVALID_FEDERATION_DISPLAY_STATE");

  const seen=new Set<string>();
  const schools: FederationDashboardSchool[]=report.schools.map(school=>{
    if(!UUID.test(school.schoolId) || seen.has(school.schoolId.toLowerCase()) ||
      !school.schoolName?.trim() || school.schoolName.length>200 ||
      typeof school.suppressed!=="boolean" ||
      (school.suppressed && school.metrics!==null) ||
      (!school.suppressed && !school.metrics))
      throw Error("INVALID_FEDERATION_DISPLAY_STATE");
    seen.add(school.schoolId.toLowerCase());
    return {id:school.schoolId.toLowerCase(),name:school.schoolName.trim(),
      suppressed:school.suppressed,metrics:school.suppressed?null:project(school.metrics!)};
  });
  if(schools.length===0)throw Error("INVALID_FEDERATION_DISPLAY_STATE");
  // No synthetic zeroes and no public total if any source suppressed it.
  const totalSuppressed=report.totalSuppressed===true || report.total===null;
  return {organization,period:report.period,
    periodLabel:report.period==="90d"?"Últimos 90 días":
      report.period==="365d"?"Últimos 365 días":"Histórico",
    start:report.start,end:report.end,schools,
    total:totalSuppressed?null:project(report.total!),totalSuppressed};
}
