import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Synthetic-only, no DB connection, runtime endpoint or real personal data.
function loadTs(path, requireMap={}) {
  const source=readFileSync(path,"utf8");
  const transpiled=ts.transpileModule(source,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  });
  const mod={exports:{}};
  vm.runInNewContext(transpiled.outputText,{
    module:mod,exports:mod.exports,Set,Map,
    require(name){if(!(name in requireMap))throw Error("unexpected dependency "+name);return requireMap[name];}
  });
  return mod.exports;
}
const membership=loadTs("lib/reports/school-membership.ts");
const {computeFederationKpis}=loadTs("lib/fanpa/federation-kpis.ts",{
  "@/lib/reports/school-membership":membership
});
const school=(id,name)=>({id,name});
const student=(user,school_id)=>({owner_user_id:user,school_id});
const empty={profiles:[],students:[],admins:[],listings:[],demands:[],agreements:[]};

test("membership ignores old profile school if the family has any active students",()=>{
  const found=membership.getSchoolMemberIds({
    schoolId:"A", profiles:[{id:"family",school_id:"A"}],
    activeStudents:[student("family","B")],schoolAdmins:[]
  });
  assert.equal(found.has("family"),false);
  assert.equal(membership.getSchoolMemberIds({
    schoolId:"A",profiles:[{id:"family",school_id:"A"}],activeStudents:[],schoolAdmins:[]
  }).has("family"),true);
});

test("federation aggregates only represented schools, deduplicating cross-school families",()=>{
 const actual=computeFederationKpis({
   schools:[school("A","Cole A"),school("B","Cole B")],
   profiles:[{id:"family1",school_id:"A"},{id:"family2",school_id:"B"}],
   students:[student("family1","A"),student("family1","B"),
     student("family1","A"),student("family2","B")],
   admins:[{user_id:"adminA",school_id:"A"}],
   listings:[{id:"a",school_id:"A",status:"available"},{id:"b",school_id:"B",status:"reserved"},
     {id:"foreign",school_id:"C",status:"available"}],
   demands:[{id:"d1",school_id:"A",status:"open"},{id:"d2",school_id:"B",status:"matched"}],
   agreements:[{id:"e1",school_id:"A",status:"confirmed"}]
 });
 assert.equal(actual.totalSchools,2);
 assert.equal(actual.uniqueUsers,3);
 assert.equal(actual.students,4);
 assert.equal(actual.activeListings,2);
 assert.equal(actual.openDemands,2);
 assert.equal(actual.confirmedExchanges,1);
 assert.deepEqual(Array.from(actual.schools.map(s=>s.users)),[2,2]);
 assert.equal(JSON.stringify(actual).includes("family1"),false,"no member identities in KPI payload");
 assert.equal(JSON.stringify(actual).includes("adminA"),false);
});

test("empty represented school set yields no figures even with foreign activity",()=>{
 const result=computeFederationKpis({...empty,schools:[],
   listings:[{id:"x",school_id:"outside",status:"available"}],
   students:[student("private-user","outside")]
 });
 assert.equal(result.totalSchools,0);
 assert.equal(result.uniqueUsers,0);
 assert.equal(result.totalListings,0);
 assert.deepEqual(Array.from(result.schools),[]);
});

test("aggregation module is not wired into any user-facing route or role grant",()=>{
 const src=readFileSync("lib/fanpa/federation-kpis.ts","utf8");
 assert.doesNotMatch(src,/createAdminClient|from\("profiles"\)|auth\.getUser|service_role|CREATE POLICY/);
});
