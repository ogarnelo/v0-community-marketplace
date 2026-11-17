"use client";

import { useState } from "react";
import { FederationKpiDashboard } from "@/components/admin/federation-kpi-dashboard";
import { buildFederationDashboardModel } from "@/lib/reports/federation-dashboard-view-model";
import type { FederationReportResult } from "@/lib/reports/federation-report-gateway";
import type { PublicKpi, SchoolKpiView } from "@/lib/reports/federation-kpi-projection";

type Period = "90d" | "365d" | "total";
type Scenario = "complete" | "suppressed";
const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const date = "2026-11-17T12:00:00.000Z";

/** Synthetic-only data. This module is NEVER imported by a production route. */
function exampleMetrics(period:Period,school:"a"|"b"):PublicKpi{
 const factor = period==="90d"?1:period==="365d"?3:5;
 const multiplier=school==="a"?2:1;
 const soldItems=factor*multiplier;
 const donatedItems=factor;
 return {
  reusedItems:soldItems+donatedItems,
  donatedItems,soldItems,
  circularValue:25*factor*multiplier,
  estimatedAvoidedCo2:3.5*factor*multiplier,
  activeListings:6*multiplier,
  listingViews:38*factor*multiplier,
 };
}
function total(a:PublicKpi,b:PublicKpi):PublicKpi{
 return {
  reusedItems:a.reusedItems+b.reusedItems,
  donatedItems:a.donatedItems+b.donatedItems,
  soldItems:a.soldItems+b.soldItems,
  circularValue:a.circularValue+b.circularValue,
  estimatedAvoidedCo2:a.estimatedAvoidedCo2+b.estimatedAvoidedCo2,
  activeListings:a.activeListings+b.activeListings,
  listingViews:a.listingViews+b.listingViews,
 };
}
export function makeSyntheticFederationReport(period:Period,scenario:Scenario):FederationReportResult{
 const a=exampleMetrics(period,"a"),b=exampleMetrics(period,"b");
 const schools:SchoolKpiView[]=[
  {schoolId:ID_A,schoolName:"CEIP Ejemplo Norte (sintético)",metrics:a,suppressed:false},
  {schoolId:ID_B,schoolName:"CEIP Ejemplo Sur (sintético)",
    metrics:scenario==="suppressed"?null:b,
    suppressed:scenario==="suppressed"},
 ];
 return {period,start:period==="90d"?"2026-08-19T12:00:00.000Z":
     period==="365d"?"2025-11-17T12:00:00.000Z":null,
  end:date,schools,
  total:scenario==="suppressed"?null:total(a,b),
  totalSuppressed:scenario==="suppressed",
 };
}
export function FederationDashboardLocalDemo(){
 const [period,setPeriod]=useState<Period>("365d");
 const [scenario,setScenario]=useState<Scenario>("complete");
 const model=buildFederationDashboardModel({
  organization:scenario==="suppressed"
    ?"FAMPA de ensayo — privacidad"
    :"FAMPA de ensayo — resultados",
  report:makeSyntheticFederationReport(period,scenario),
 });
 return (
  <div className="space-y-6">
   <div className="mx-auto max-w-7xl rounded-xl border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-200">
    <p className="font-semibold">Demostración local con datos 100 % sintéticos</p>
    <p className="mt-1">Sin usuarios reales, sin consultas a Supabase y sin acceso federativo habilitado.
      Esta vista solo está disponible en desarrollo.</p>
    <label className="mt-3 block max-w-sm space-y-2">
     <span className="block font-medium">Escenario de privacidad</span>
     <select aria-label="Cambiar escenario de privacidad"
      className="w-full rounded-md border border-amber-500/50 bg-background px-3 py-2 text-foreground"
      value={scenario}
      onChange={e=>{
       if(e.target.value==="complete"||e.target.value==="suppressed")
        setScenario(e.target.value);
      }}>
      <option value="complete">Dos colegios con indicadores</option>
      <option value="suppressed">Colegio pequeño con datos protegidos</option>
     </select>
    </label>
   </div>
   <FederationKpiDashboard key={scenario} model={model} onPeriodChange={setPeriod}/>
  </div>
 );
}
