import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const UUID="11111111-1111-4111-8111-111111111111";
const USER="22222222-2222-4222-8222-222222222222";
function execute({kind, noRows=false, relationship="guardian", active=true, role="parent", stateChanged=false}){
 const calls=[];
 const row={id:UUID,owner_user_id:USER,relationship,active,is_primary:false};
 const makeQuery=(table)=>{
   let operation="read",filters=[];
   const q={
     select:()=>q,eq:(name,value)=>{filters.push([name,value]);return q;},
     update:()=>{operation="update";return q;},maybeSingle:async()=>{
       calls.push({table,operation,filters});
       if(table==="profiles")return {data:{user_type:role},error:null};
       if(table==="account_students"){
         if(operation==="read")return {data:row,error:null};
         const match=filters.every(([key,val])=>key==="id"?val===UUID:key==="owner_user_id"?val===USER:key==="active"?!stateChanged&&val===active:key==="relationship"?!stateChanged&&val===relationship:key==="is_primary"?val===row.is_primary:true);
         return {data:noRows||!match?null:{id:UUID,...row},error:null};
       }
       return {data:null,error:null};
     }
   };return q;
 };
 const compiled=ts.transpileModule(readFileSync("lib/account-students/server.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const out={};vm.runInNewContext(compiled.outputText,{exports:out,require:(key)=>key==="@/lib/supabase/admin"?{createAdminClient:()=>({from:makeQuery})}:{},Date,Error,console,process:{env:{WETUDY_R2_STUDENT_ATOMIC_DEACTIVATE_ENABLED:'false'}}});
 const input={alias:null,schoolId:null,directorySchoolCode:null,gradeLevel:"4 ESO"};
 return {calls,run:()=>kind==="update"?out.updateAccountStudent(USER,UUID,input):out.deactivateAccountStudent(USER,UUID)};
}
for(const kind of ["update","delete"]){
 test(kind+" succeeds when live state matches",async()=>{
   const h=execute({kind});const value=await h.run();
   assert.equal(value.id,UUID);
   const update=h.calls.find(x=>x.operation==="update");
   assert.ok(update);
   assert.deepEqual(update.filters.filter(x=>x[0]==="active"),[["active",true]]);
   assert.deepEqual(update.filters.filter(x=>x[0]==="relationship"),[["relationship","guardian"]]);
 });
 test(kind+" conflicts on zero affected rows",async()=>{
   const h=execute({kind,noRows:true});
   await assert.rejects(h.run(),e=>e.code==="student_state_changed"&&e.status===409);
 });
 test(kind+" conflicts on a concurrent state change",async()=>{
   const h=execute({kind,stateChanged:true});
   await assert.rejects(h.run(),e=>e.code==="student_state_changed"&&e.status===409);
 });
 test(kind+" rejects stale self/guardian relationship",async()=>{
   const h=execute({kind,relationship:"self",role:"parent"});
   await assert.rejects(h.run(),e=>e.code==="relationship_mismatch"&&e.status===409);
 });
}
test("deleting a student's own context remains blocked",async()=>{
 const h=execute({kind:"delete",relationship:"self",role:"student"});
 await assert.rejects(h.run(),e=>e.code==="self_context_required"&&e.status===409);
});
