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
 const deps={loadDemandOpportunities:async()=>++reads===1?[opp]:fresh,findSupplyCandidates:async()=>({candidates:[{userId:"target",contactAllowed:true}]}),revalidateSupplyTargets:async(o,ids)=>ids,activationMessage:()=>"QA",opportunityMetadata:()=>({}),demandIsSatisfied:o=>o.supplyCount>=o.familiesCount};
 vm.runInNewContext(ts.transpileModule(read("lib/admin/automatic-supply-worker.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:p=>p.includes("automatic-supply-plan")?{planAutomaticSupply}:deps});
 const admin={rpc:async(name,args)=>{calls.push({name,args});return {data:name==="automatic_supply_enabled_v1"?states.shift():true}}};
 return {run:()=>exports.runAutomaticSupply(admin),calls};
}
test("worker dispatches using system identity",async()=>{const f=fixture();const r=await f.run();assert.equal(r.sent,1);assert.equal(f.calls.at(-1).args.p_actor,null)});
test("pause prevents dispatch",async()=>{const f=fixture([true,false]);assert.equal((await f.run()).sent,0);assert.ok(f.calls.every(c=>c.name==="automatic_supply_enabled_v1"))});
test("covered fresh demand stops dispatch",async()=>{const f=fixture([true,true],[{...opp,supplyCount:1}]);assert.equal((await f.run()).sent,0)});
test("daily path is gated and uses existing schedule",()=>{assert.match(read("app/api/cron/email-health/route.ts"),/WETUDY_AUTOMATIC_SUPPLY_ENABLED==="true"/);assert.match(read("app/api/cron/email-health/route.ts"),/runAutomaticSupply\(admin\)/)});
