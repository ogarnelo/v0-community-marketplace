import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const read=p=>readFileSync(p,"utf8");
const exports={};vm.runInNewContext(ts.transpileModule(read("lib/admin/pilot-supply-default.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>({})});
test("flag strictly enables global default",()=>{
 assert.equal(exports.pilotSupplyDefault(undefined),false);
 assert.equal(exports.pilotSupplyDefault("false"),false);
 assert.equal(exports.pilotSupplyDefault("true"),true);
});
test("all account types, explicit false and prior opt-out",async()=>{
 const rows=new Map();
 const db={from(table){assert.equal(table,"user_marketplace_preferences");return {async upsert(row,options){assert.equal(options.ignoreDuplicates,true);if(!rows.has(row.user_id))rows.set(row.user_id,row.supply_outreach_opt_in);return {error:null}}}}};
 for(const role of ["parent","student","business","school_admin","super_admin"]){
  await exports.initializePilotSupplyPreference(db,{id:role,user_metadata:{user_type:role}},"true");
  assert.equal(rows.get(role),true);
 }
 await exports.initializePilotSupplyPreference(db,{id:"optout",user_metadata:{wetudy_supply_notice_initial:false}},"true");
 await exports.initializePilotSupplyPreference(db,{id:"optout"},"true");
 assert.equal(rows.get("optout"),false);
 await exports.initializePilotSupplyPreference(db,{id:"off"},"false");
 assert.equal(rows.has("off"),false);
});
test("signup and both confirmation paths provide choice and preserve previous preferences",()=>{
 const api=read("app/api/account/supply-outreach/route.ts"),ui=read("components/onboarding/account-students-onboarding.tsx"),form=read("components/auth/auth-form.tsx");
 assert.ok(!api.includes("PILOT_SUPPLY_SCHOOL_IDS"));
 assert.ok(api.includes("ignoreDuplicates:true"));
 assert.ok(ui.includes("checked={pilotChoice}"));
 assert.ok(form.includes("checked={supplyNotice}"));
 assert.ok(form.includes("wetudy_supply_notice_initial: pilotSupplyEnabled && supplyNotice"));
 for(const p of ["app/auth/callback/route.ts","app/auth/confirm/route.ts"])assert.ok(read(p).includes("initializePilotSupplyPreference(supabase,"));
});
