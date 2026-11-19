import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
function load(path,requires={}){
 const exports={};
 const js=ts.transpileModule(readFileSync(path,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports,require:(name)=>{assert.ok(name in requires,name);return requires[name]},
  Date,Map,Set,Number,Object,Error},{timeout:1500});
 return exports;
}
const adapter=load("lib/reports/federation-authority-snapshot.ts");
const scope=load("lib/reports/federation-reporting-scope.ts");
const hierarchy=load("lib/reports/federation-reporting-hierarchy.ts",{"./federation-reporting-scope":scope});
const id=n=>String(n).padStart(8,"0")+"-1111-4111-8111-111111111111";
const user=id(1),ceapa=id(2),fampa=id(3),ampa=id(4),school=id(5),verifier=id(6);
const now=new Date("2026-11-17T12:00:00.000Z");
const good=(over={})=>({
 complete:{organizations:true,associations:true,schools:true,associationSchools:true,
  organizationAssociations:true,hierarchy:true,memberships:true},
 organizations:[{id:ceapa,status:"verified"},{id:fampa,status:"verified"}],
 associations:[{id:ampa,status:"verified"}],
 schools:[{id:school,is_active:true}],
 associationSchools:[{association_id:ampa,school_id:school,status:"verified",
  verified_by:verifier,valid_from:"2026-01-01T00:00:00+00:00",valid_until:null}],
 organizationAssociations:[{organization_id:fampa,association_id:ampa,status:"verified",
  verified_by:verifier,valid_from:"2026-05-01T00:00:00+00:00",valid_until:null}],
 hierarchy:[{parent_id:ceapa,child_id:fampa,status:"verified",
  verified_by:verifier,valid_from:"2026-01-01T00:00:00+00:00",valid_until:null}],
 memberships:[{organization_id:ceapa,user_id:user,role:"report_viewer",status:"active",verified_by:verifier}],
 ...over
});
const build=snapshot=>adapter.buildFederationAuthoritySnapshot({userId:user,rootFederationId:ceapa,now,snapshot});
const allowed=snap=>Array.from(hierarchy.resolveHierarchySchoolScope(build(snap)));
test("CEAPA only inherits a school with verified legal AMPA and every valid link",()=>{
 const auth=build(good());
 assert.deepEqual(allowed(good()),[school]);
 assert.equal(auth.representations.length,1);
 assert.equal(auth.representations[0].startsAt,"2026-05-01T00:00:00.000Z");
});
test("missing required pagination completeness refuses to build authority",()=>{
 const x=good();x.complete.schools=false;
 assert.throws(()=>build(x),/INCOMPLETE_FEDERATION_AUTHORITY_SNAPSHOT/);
 assert.throws(()=>build({...good(),schools:null}),/INCOMPLETE_FEDERATION_AUTHORITY_SNAPSHOT/);
});
test("pending/revoked AMPAs and inactive schools cannot be represented",()=>{
 assert.deepEqual(allowed(good({associations:[{id:ampa,status:"pending"}]})),[]);
 assert.deepEqual(allowed(good({schools:[{id:school,is_active:false}]})),[]);
 assert.deepEqual(allowed(good({schools:[{id:school,is_active:null}]})),[]);
});
test("verification and both legal relationships are mandatory",()=>{
 const x=good(),relation=x.organizationAssociations[0],pair=x.associationSchools[0];
 assert.deepEqual(allowed(good({organizationAssociations:[{...relation,status:"revoked"}]})),[]);
 assert.deepEqual(allowed(good({associationSchools:[{...pair,verified_by:null}]})),[]);
 assert.deepEqual(allowed(good({hierarchy:[{...x.hierarchy[0],verified_by:null}]})),[]);
});
test("expired representation or future link cannot confer reporting access",()=>{
 const x=good();
 assert.deepEqual(allowed(good({organizationAssociations:[
  {...x.organizationAssociations[0],valid_until:"2026-09-01T00:00:00+00:00"}
 ]})),[]);
 assert.deepEqual(allowed(good({hierarchy:[
  {...x.hierarchy[0],valid_from:"2026-12-01T00:00:00+00:00"}
 ]})),[]);
});
test("unverified CEAPA membership cannot inherit descendant schools",()=>{
 const x=good();
 assert.deepEqual(allowed(good({memberships:[{...x.memberships[0],verified_by:null}]})),[]);
 assert.deepEqual(allowed(good({memberships:[{...x.memberships[0],status:"revoked"}]})),[]);
});
test("legal identity and school are different; invalid timestamp fails safely",()=>{
 assert.notEqual(ampa,school);
 const x=good();
 assert.throws(()=>build(good({organizationAssociations:[
  {...x.organizationAssociations[0],valid_from:"not-a-date"}]})),/INVALID_FEDERATION_TIMESTAMP/);
});

test("contradictory duplicate legal relationships cannot restore a revoked grant",()=>{
 const x=good();const original=x.organizationAssociations[0];
 assert.throws(()=>build(good({organizationAssociations:[original,
  {...original,status:"revoked"}]})),/CONFLICTING_FEDERATION_SNAPSHOT/);
 assert.throws(()=>build(good({schools:[{id:school,is_active:true},{id:school,is_active:false}]})),
  /CONFLICTING_FEDERATION_SNAPSHOT/);
});


/** Synthetic pilot cohort only: two fictitious schools, three fictitious AMPAs,
 *  two fictitious FAMPAs and a fictitious CEAPA; never seeded in Supabase. */
const pilotSchoolA=id(10),pilotSchoolB=id(11);
const pilotAmpaA=id(12),pilotAmpaB=id(13),pilotAmpaC=id(14);
const pilotFampaB=id(15);
function syntheticTwoSchoolThreeAmpaSnapshot() {
 const verified=(relation)=>({...relation,status:"verified",verified_by:verifier,
   valid_from:"2026-01-01T00:00:00+00:00",valid_until:null});
 return good({
  organizations:[{id:ceapa,status:"verified"},{id:fampa,status:"verified"},
   {id:pilotFampaB,status:"verified"}],
  associations:[pilotAmpaA,pilotAmpaB,pilotAmpaC].map(id=>({id,status:"verified"})),
  schools:[pilotSchoolA,pilotSchoolB].map(id=>({id,is_active:true})),
  associationSchools:[
   verified({association_id:pilotAmpaA,school_id:pilotSchoolA}),
   verified({association_id:pilotAmpaB,school_id:pilotSchoolA}),
   verified({association_id:pilotAmpaC,school_id:pilotSchoolB}),
  ],
  organizationAssociations:[
   verified({organization_id:fampa,association_id:pilotAmpaA}),
   verified({organization_id:fampa,association_id:pilotAmpaB}),
   verified({organization_id:pilotFampaB,association_id:pilotAmpaC}),
  ],
  hierarchy:[verified({parent_id:ceapa,child_id:fampa})],
  memberships:[{organization_id:ceapa,user_id:user,role:"report_viewer",
   status:"active",verified_by:verifier}],
 });
}
test("pilot ficticio: CEAPA solo puede consultar colegios de AMPAs representadas",()=>{
 const s=syntheticTwoSchoolThreeAmpaSnapshot();
 assert.equal(s.schools.length,2);
 assert.equal(s.associations.length,3);
 assert.deepEqual(allowed(s),[pilotSchoolA]);
 assert.throws(()=>scope.requireRepresentedSchool(allowed(s),pilotSchoolB),/DENIED/);
});
test("piloto ficticio: FAMPA B solo puede ver el colegio B de su AMPA ficticia",()=>{
 const s=syntheticTwoSchoolThreeAmpaSnapshot();
 s.memberships=[{organization_id:pilotFampaB,user_id:user,role:"report_viewer",
  status:"active",verified_by:verifier}];
 const authority=adapter.buildFederationAuthoritySnapshot({
  userId:user,rootFederationId:pilotFampaB,now,snapshot:s
 });
 assert.deepEqual(Array.from(hierarchy.resolveHierarchySchoolScope(authority)),[pilotSchoolB]);
 assert.throws(()=>scope.requireRepresentedSchool([pilotSchoolB],pilotSchoolA),/DENIED/);
});
test("piloto ficticio: AMPA desverificada no concede reporting a su federación",()=>{
 const s=syntheticTwoSchoolThreeAmpaSnapshot();
 s.associations=s.associations.map(x=>({...x,status:"pending"}));
 assert.deepEqual(allowed(s),[]);
});
test("piloto ficticio: no se filtran usuarios, correos ni identificadores de otro colegio",()=>{
 const s=syntheticTwoSchoolThreeAmpaSnapshot();
 const authority=build(s);
 // The trusted backend snapshot can contain cross-federation links, but
 // the resolved authorization scope delivered to the reporting loader must not.
 const authorized=Array.from(hierarchy.resolveHierarchySchoolScope(authority));
 assert.deepEqual(authorized,[pilotSchoolA]);
 assert.throws(()=>scope.requireRepresentedSchool(authorized,pilotSchoolB),/DENIED/);
 assert.equal(authority.representations.length,3);
 const text=JSON.stringify({allowedSchools:authorized});
 assert.doesNotMatch(text,/correo|phone|email|password|address|storage_path|service_role/i);
 assert.equal(s.associations.length,3);
});
