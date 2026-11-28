import "server-only";
import { planAutomaticSupply } from "@/lib/admin/automatic-supply-plan.mjs";
import { loadDemandOpportunities, findSupplyCandidates, revalidateSupplyTargets, activationMessage, opportunityMetadata, demandIsSatisfied, type DemandOpportunity } from "@/lib/admin/demand-opportunities";

export async function automaticSupplyEnabled(admin: any): Promise<boolean> {
 const {data,error}=await admin.rpc("automatic_supply_enabled_v1");
 if(error || typeof data!=="boolean") throw new Error("automatic_supply_control_unavailable");
 return data;
}
function campaign(o: DemandOpportunity) {
 return {title:o.title,opportunity_key:o.key,school_id:o.schoolId,category:o.category,
 grade_level:o.gradeLevel,isbn:o.isbn,specific_type:o.specificType,size_label:o.sizeLabel,brand:o.brand,model:o.model,
 families_count:o.familiesCount,searches_count:o.searchesCount,supply_count:o.supplyCount,first_seen_at:o.firstSeenAt,last_seen_at:o.lastSeenAt,
 priority:o.familiesCount>=3 && o.supplyCount===0?"high":"medium",metadata:opportunityMetadata(o)};
}
function checkedTargets(value: unknown): string[] {
 if(!Array.isArray(value)||value.some(id=>typeof id!=="string"))throw Error("automatic_supply_invalid_targets");
 return value;
}
export async function runAutomaticSupply(admin: any) {
 if (!await automaticSupplyEnabled(admin)) return {status:"paused",sent:0};
 const result=await planAutomaticSupply({
  load:()=>loadDemandOpportunities(admin,{strict:true}),
  candidates:(o:DemandOpportunity)=>findSupplyCandidates(admin,o),
  revalidate:async(o:DemandOpportunity,ids:string[])=>checkedTargets(await revalidateSupplyTargets(admin,o,ids))
 });
 let sent=0;
 for(const entry of result.plan) {
  for(const target of entry.targets) {
   if(!await automaticSupplyEnabled(admin)) return {status:"paused",sent};
   // Re-read authoritative demand and current supply before each individual send.
   const fresh=(await loadDemandOpportunities(admin,{strict:true})).find(o=>o.key===entry.key);
   if(!fresh || demandIsSatisfied(fresh)) break;
   if(!checkedTargets(await revalidateSupplyTargets(admin,fresh,[target])).includes(target)) continue;
   const {data,error}=await admin.rpc("activate_supply_recipient_v2",{
    p_actor:null,p_target:target,p_campaign:campaign(fresh),p_message:activationMessage(fresh),
    p_href:`/supply-opportunity/${encodeURIComponent(fresh.key)}`
   });
   if(error || typeof data!=="boolean") throw new Error("automatic_supply_dispatch_failed");
   if(data)sent++;
  }
 }
 return {status:"completed",sent,inspected:result.inspected};
}

// Persist only aggregate operational counters; no recipient or search content.
export async function runRecordedAutomaticSupply(admin: any, trigger: "cron" | "api" = "cron") {
 const start=Date.now();
 const {data,error}=await admin.from("automation_runs").insert({
  job_id:"automatic_supply_v1",job_name:"Demanda inteligente automática",status:"running",trigger_source:trigger
 }).select("id").single();
 if(error||!data?.id)throw Error("automatic_supply_audit_unavailable");
 const finish=async(status:string,result:Record<string,unknown>,ok:boolean)=>{
  const {error}=await admin.from("automation_runs").update({
   status,ok,result,finished_at:new Date().toISOString(),duration_ms:Date.now()-start,
   error:ok?null:"automatic_supply_run_failed"
  }).eq("id",data.id);
  if(error)throw Error("automatic_supply_audit_finish_failed");
 };
 let result:Awaited<ReturnType<typeof runAutomaticSupply>>;
 try{result=await runAutomaticSupply(admin);}
 catch{await finish("failed",{},false);throw Error("automatic_supply_run_failed");}
 await finish(result.status==="paused"?"skipped":"succeeded",result,true);
 return result;
}
