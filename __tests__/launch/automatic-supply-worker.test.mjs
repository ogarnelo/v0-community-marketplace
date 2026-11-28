import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import {planAutomaticSupply} from "../../lib/admin/automatic-supply-plan.mjs";
const read=p=>readFileSync(p,"utf8");
const opp={key:"qa",status:"new",familiesCount:1,supplyCount:0,demandUserIds:[]};
function fixture(states=[true,true],fresh=[opp]){
 const calls=[];let reads=0;
 const exports={};
 const deps={loadDemandOpportunities:async(admin,options)=>{assert.equal(options.strict,true);return ++reads===1?[opp]:fresh},findSupplyCandidates:async()=>({candidates:[{userId:"target",contactAllowed:true}]}),revalidateSupplyTargets:async(admin,o,ids)=>{assert.ok(Array.isArray(ids));return ids},activationMessage:()=>"QA",opportunityMetadata:()=>({}),demandIsSatisfied:o=>o.supplyCount>=o.familiesCount};
 vm.runInNewContext(ts.transpileModule(read("lib/admin/automatic-supply-worker.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:p=>p.includes("automatic-supply-plan")?{planAutomaticSupply}:deps});
 const admin={rpc:async(name,args)=>{calls.push({name,args});return {data:name==="automatic_supply_enabled_v1"?states.shift():true}}};
 const audit=[];
 admin.from=table=>{assert.equal(table,"automation_runs");return {
 insert:row=>{audit.push(row);return {select:()=>({single:async()=>({data:{id:"run"}})})}},
 update:row=>{audit.push(row);return {eq:async(k,v)=>{assert.equal(v,"run");return {error:null}}}}
 }};
 return {run:()=>exports.runAutomaticSupply(admin),record:()=>exports.runRecordedAutomaticSupply(admin),calls,audit,admin};
}
test("worker dispatches using system identity",async()=>{const f=fixture();const r=await f.run();assert.equal(r.sent,1);assert.equal(f.calls.at(-1).args.p_actor,null)});
test("pause prevents dispatch",async()=>{const f=fixture([true,false]);assert.equal((await f.run()).sent,0);assert.ok(f.calls.every(c=>c.name==="automatic_supply_enabled_v1"))});
test("covered fresh demand stops dispatch",async()=>{const f=fixture([true,true],[{...opp,supplyCount:1}]);assert.equal((await f.run()).sent,0)});
test("daily path is gated and uses existing schedule",()=>{assert.match(read("app/api/cron/email-health/route.ts"),/WETUDY_AUTOMATIC_SUPPLY_ENABLED==="true"/);assert.match(read("app/api/cron/email-health/route.ts"),/runRecordedAutomaticSupply\(admin\)/)});

test("recorded runs store aggregate counters and paused status",async()=>{
 const f=fixture([false]);await f.record();assert.equal(f.audit[0].status,"running");assert.equal(f.audit[1].status,"skipped");assert.equal(f.audit[1].result.sent,0);
 const g=fixture();await g.record();assert.equal(g.audit[1].status,"succeeded");assert.equal(g.audit[1].result.sent,1);
});
test("missing audit prevents all sends",async()=>{const f=fixture();f.admin.from=()=>({insert:()=>({select:()=>({single:async()=>({error:true})})})});await assert.rejects(f.record(),/audit_unavailable/);assert.equal(f.calls.length,0)});
test("failed dispatch records failure",async()=>{const f=fixture();f.admin.rpc=async()=>({error:true});await assert.rejects(f.record(),/run_failed/);assert.equal(f.audit[1].status,"failed");assert.equal(f.audit[1].ok,false)});
