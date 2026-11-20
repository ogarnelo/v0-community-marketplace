import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const src=readFileSync("lib/fanpa/federation-representation.ts","utf8");
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
vm.runInNewContext(js,{exports:mod.exports,module:mod,Set,Map});
const {resolveFederationRepresentation:authorize}=mod.exports;

const base={
 authenticatedUserId:"federation-admin",
 requestedFederationId:"F1",
 federations:[{id:"F1",is_active:true,is_test:false},{id:"F2",is_active:true,is_test:false}],
 administratorLinks:[{federation_id:"F1",user_id:"federation-admin",active:true}],
 schoolLinks:[{federation_id:"F1",school_id:"A",active:true},
  {federation_id:"F1",school_id:"B",active:true},
  {federation_id:"F2",school_id:"C",active:true}],
 schools:[{id:"A",is_active:true,is_test:false},
  {id:"B",is_active:true,is_test:false},
  {id:"C",is_active:true,is_test:false}]
};
const auth=(changes={})=>authorize({...base,...changes});

test("only schools in the explicitly represented federation enter the allowlist",()=>{
 const result=auth();
 assert.equal(result.authorized,true);
 assert.equal(result.federationId,"F1");
 assert.deepEqual(Array.from(result.representedSchoolIds),["A","B"]);
 assert.equal(JSON.stringify(result).includes("C"),false);
 assert.equal(JSON.stringify(result).includes("federation-admin"),false);
});

test("no user, wrong federation or admin of another federation gets any access",()=>{
 assert.equal(auth({authenticatedUserId:null}).authorized,false);
 assert.equal(auth({authenticatedUserId:"school-admin"}).authorized,false);
 assert.equal(auth({requestedFederationId:"F2"}).authorized,false);
 assert.equal(auth({requestedFederationId:"unlisted"}).authorized,false);
});

test("revocation, duplicate grants and disabled/test federations fail closed",()=>{
 assert.equal(auth({administratorLinks:[]}).authorized,false);
 assert.equal(auth({administratorLinks:[{federation_id:"F1",user_id:"federation-admin",active:false}]}).authorized,false);
 assert.equal(auth({administratorLinks:[...base.administratorLinks,...base.administratorLinks]}).authorized,false);
 assert.equal(auth({federations:[{id:"F1",is_active:false,is_test:false}]}).authorized,false);
 assert.equal(auth({federations:[{id:"F1",is_active:true,is_test:true}]}).authorized,false);
 assert.equal(auth({federations:[base.federations[0],base.federations[0]]}).authorized,false);
});

test("partial provider reads never become allowed empty scopes",()=>{
 for(const key of ["federations","administratorLinks","schoolLinks","schools"]) {
  assert.equal(auth({[key]:null}).authorized,false,key);
 }
});

test("missing, inactive and test school invalidates the whole report rather than trimming counts",()=>{
 assert.equal(auth({schools:base.schools.filter(s=>s.id!=="B")}).authorized,false);
 assert.equal(auth({schools:base.schools.map(s=>s.id==="B"?{...s,is_active:false}:s)}).authorized,false);
 assert.equal(auth({schools:base.schools.map(s=>s.id==="B"?{...s,is_test:true}:s)}).authorized,false);
 assert.equal(auth({schoolLinks:[]}).authorized,false);
 assert.equal(auth({schoolLinks:[{federation_id:"F1",school_id:"A",active:false}]}).authorized,false);
});

test("deactivated school links no longer contribute; repeated links do not double-count",()=>{
 const links=[...base.schoolLinks,{federation_id:"F1",school_id:"A",active:true},
  {federation_id:"F1",school_id:"B",active:false}];
 const result=auth({schoolLinks:links});
 assert.equal(result.authorized,true);
 assert.deepEqual(Array.from(result.representedSchoolIds),["A","B"]);
 const revoked=auth({schoolLinks:links.filter(x=>!(x.school_id==="B" && x.active))});
 assert.equal(revoked.authorized,true);
 assert.deepEqual(Array.from(revoked.representedSchoolIds),["A"]);
});

test("authorization helper cannot query DB or accept user-owned JWT roles as authority",()=>{
 assert.doesNotMatch(src,/createAdminClient|createClient|auth\.jwt|user_metadata|\.from\("|fetch\(/);
 assert.match(src,/memberLinks.length !== 1/);
 assert.match(src,/school\.is_test === true/);
});
