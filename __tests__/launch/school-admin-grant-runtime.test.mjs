import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const ts=createRequire(import.meta.url)("typescript");
const SCHOOL="11111111-1111-4111-8111-111111111111";
const USER="22222222-2222-4222-8222-222222222222";
function makeCase(opts={}) {
  const calls=[], out={};
  const admin={from:(table)=>{
    const query={table,filters:[],method:"select",
      select:()=>query,
      eq:(k,v)=>{query.filters.push([k,v]);return query;},
      neq:(k,v)=>{query.filters.push(["neq:"+k,v]);return query;},
      limit:async()=>({data:opts.conflict?[{school_id:"other-school"}]:[],
        error:opts.conflictQueryError?{message:"PRIVATE_CONFLICT_ERROR"}:null}),
      maybeSingle:async()=>{
        if(table==="schools")return {data:opts.missingSchool?null:
          {id:SCHOOL,is_active:!opts.inactiveSchool},
          error:opts.schoolError?{message:"PRIVATE_SCHOOL_ERROR"}:null};
        if(table==="user_roles")return {data:opts.existingRole?{id:SCHOOL}:null,
          error:opts.roleError?{message:"PRIVATE_ROLE_ERROR"}:null};
        throw Error("Unexpected "+table);
      },
      insert:async()=>{calls.push("ROLE_INSERT");return {error:null};},
      update:()=>{calls.push("PROFILE_UPDATE");return {
        eq:async()=>({error:null}),
      };},
    };
    calls.push("READ:"+table);
    return query;
  }};
  const transpiled=ts.transpileModule(
    readFileSync("lib/admin/school-admin-role.ts","utf8"),{
      fileName:"school-admin-role.ts",reportDiagnostics:true,
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
        esModuleInterop:true},
    });
  assert.equal((transpiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  vm.runInNewContext(transpiled.outputText,{exports:out,
    require:(name)=>name==="@/lib/supabase/admin"?{createAdminClient:()=>admin}:{},
    Promise,Error},{filename:"school-admin-role.js",timeout:2000});
  return {calls,grant:()=>out.grantSchoolAdminRole({userId:USER,schoolId:SCHOOL})};
}
test("inactive centre never reaches user roles or profile",async()=>{
  const h=makeCase({inactiveSchool:true});
  await assert.rejects(h.grant(),/desactivado/);
  assert.deepEqual(h.calls,["READ:schools"]);
});
test("school lookup failure prevents role writes",async()=>{
  const h=makeCase({schoolError:true});await assert.rejects(h.grant());
  assert.equal(h.calls.includes("ROLE_INSERT"),false);
});
test("other-school admin role prevents new role and profile change",async()=>{
  const h=makeCase({conflict:true});
  await assert.rejects(h.grant(),/otro centro/);
  assert.equal(h.calls.includes("ROLE_INSERT"),false);
  assert.equal(h.calls.includes("PROFILE_UPDATE"),false);
});
test("role query error fails closed",async()=>{
  const h=makeCase({conflictQueryError:true});await assert.rejects(h.grant());
  assert.equal(h.calls.includes("ROLE_INSERT"),false);
});
test("valid school admin grant updates profile after role insertion",async()=>{
  const h=makeCase();await h.grant();
  assert.ok(h.calls.indexOf("ROLE_INSERT")>=0);
  assert.ok(h.calls.indexOf("PROFILE_UPDATE")>h.calls.indexOf("ROLE_INSERT"));
});
