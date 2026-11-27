import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const read=p=>readFileSync(p,"utf8");
const exports={};vm.runInNewContext(ts.transpileModule(read("lib/admin/pilot-supply-default.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>({})});
const id="11111111-1111-4111-8111-111111111111";
test("pilot flag is off by default and invalid scope fails closed",()=>{
 assert.equal(exports.pilotSupplySchoolIds(undefined,id).length,0);
 assert.equal(exports.pilotSupplySchoolIds("true","").length,0);
 assert.equal(exports.pilotSupplySchoolIds("true",id+",bad").length,0);
 assert.equal(exports.pilotSupplySchoolIds("true",id+","+id).length,1);
});
test("initialization is scoped, never replaces explicit preferences, and shows an opt-out",()=>{
 const api=read("app/api/account/supply-outreach/route.ts"),ui=read("components/onboarding/account-students-onboarding.tsx");
 assert.ok(api.includes('profile?.user_type!=="parent"'));
 assert.ok(api.includes('.eq("owner_user_id",actor.id).eq("active",true).in("school_id",ids)'));
 assert.ok(api.includes('ignoreDuplicates:true'));
 assert.ok(api.includes('!data && await pilotEligible(actor)'));
 assert.ok(ui.includes('useState(true)'));
 assert.ok(ui.includes('checked={pilotChoice}'));
 assert.ok(ui.includes('enabled:pilotChoice'));
});
