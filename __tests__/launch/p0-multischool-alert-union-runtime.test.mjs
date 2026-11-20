import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import {partitionLiveSchool} from "../../lib/marketplace/alert-live-school.mjs";

const ts = createRequire(import.meta.url)("typescript");
function compileTs(path) {
  const src = readFileSync(path,"utf8");
  const code = ts.transpileModule(src,{fileName:path,reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.equal((code.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,path);
  const exports = {};
  runInNewContext(code.outputText,{exports,require:id=>{
    if(id==="server-only") return {};
    throw Error("Unrecognized import: "+id);
  },Promise,Set,Map},{timeout:2500});
  return exports;
}
const {savedSearchMatchesListing:matches} =
  compileTs("lib/marketplace/saved-search-matching.ts");
const {loadCurrentFamilyAlertScopes:loadScopes} =
  compileTs("lib/marketplace/active-family-alert-scopes.ts");

const U="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const V="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const W="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const C="33333333-3333-4333-8333-333333333333";

function fakeDb(){
  const db={
    errorTable:null,
    reads:[],
    students:[
      {owner_user_id:U,school_id:A,directory_school_code:null,active:true},
      {owner_user_id:U,school_id:null,directory_school_code:"28000002",active:true},
      {owner_user_id:U,school_id:C,directory_school_code:null,active:false},
      {owner_user_id:V,school_id:C,directory_school_code:null,active:true},
      {owner_user_id:W,school_id:C,directory_school_code:null,active:true},
    ],
    roles:[{user_id:W,role:"school_admin"}],
    schools:[
      {id:A,is_active:true},{id:B,is_active:true},{id:C,is_active:true},
    ],
    directories:[
      {official_code:"28000001",linked_school_id:A,is_listed:true},
      {official_code:"28000002",linked_school_id:B,is_listed:true},
      {official_code:"28000003",linked_school_id:C,is_listed:false},
    ],
    from(table){
      const rows=table==="account_students"?db.students:
        table==="user_roles"?db.roles:
        table==="schools"?db.schools:
        table==="school_directory"?db.directories:undefined;
      assert.ok(rows,table);
      db.reads.push(table);
      const filters=[];
      const q={
        select(){return q},
        in(k,values){filters.push(row=>values.includes(row[k]));return q},
        eq(k,value){filters.push(row=>row[k]===value);return q},
        limit(n){
          return Promise.resolve({data:rows.filter(row=>filters.every(fn=>fn(row))).slice(0,n),
            error:db.errorTable===table?{message:"SYNTHETIC_PROVIDER_FAILURE"}:null});
        }
      };
      return q;
    }
  };
  return db;
}
const search={
  id:"search-1",query:"Polo",only_my_community:true,
  community_scope_mode:"active_family", school_id:null,directory_school_code:null,radius_km:null,
};
const listing=(id,code=null)=>({
  id:"listing-1",title:"Polo azul",school_id:id,directory_school_code:code,
});
const activeLinks=(scope)=>({activeFamilyScope:scope});

test("one subscription matches the user's TWO current schools and no foreign school",async()=>{
  const db=fakeDb(),scope=(await loadScopes(db,[U,V,W])).get(U);
  assert.deepEqual([...scope.schoolIds].sort(),[A,B].sort());
  assert.deepEqual([...scope.directoryCodes].sort(),["28000001","28000002"].sort());
  assert.equal(matches(search,listing(A),undefined,activeLinks(scope)),true);
  assert.equal(matches(search,listing(B),undefined,activeLinks(scope)),true);
  assert.equal(matches(search,listing(null,"28000002"),undefined,activeLinks(scope)),true);
  assert.equal(matches(search,listing(C),undefined,activeLinks(scope)),false);
  assert.equal(matches(search,listing(A,"28000003"),undefined,activeLinks(scope)),false);
  assert.equal(matches(search,listing(A)),false,"no server scope must deny");
  assert.equal(matches(search,listing(A),undefined,{activeFamilyScope:null}),false);
  assert.deepEqual([...((await loadScopes(db,[U,V])).get(V).schoolIds)],[C]);
  assert.deepEqual([...((await loadScopes(db,[W])).get(W).schoolIds)],[],"school_admin may not use family mode");
});

test("revoked school is excluded at the second (delivery) check",async()=>{
  const db=fakeDb();
  const before=(await loadScopes(db,[U])).get(U);
  assert.equal(matches(search,listing(null,"28000002"),undefined,activeLinks(before)),true);
  db.students[1].active=false;
  const after=(await loadScopes(db,[U])).get(U);
  assert.equal(matches(search,listing(null,"28000002"),undefined,activeLinks(after)),false);
  assert.equal(matches(search,listing(A),undefined,activeLinks(after)),true);
  const match={id:"match1",user_id:U,saved_searches:{...search,notifications_enabled:true}};
  const deny=partitionLiveSchool([match],listing(null,"28000002"),
    new Map([["28000002",B]]),matches,new Map([[U,after]]));
  assert.deepEqual(deny.deliverable,[]);
  assert.deepEqual(deny.invalidated.map(x=>x.id),["match1"]);
  const allow=partitionLiveSchool([match],listing(null,"28000002"),
    new Map(),matches,new Map([[U,before]]));
  assert.deepEqual(allow.deliverable.map(x=>x.id),["match1"]);
});

test("inactive, unlisted or contradictory contexts cannot broaden community scope",async()=>{
  const db=fakeDb();
  db.students.push({owner_user_id:U,school_id:null,directory_school_code:"28000003",active:true});
  let scope=(await loadScopes(db,[U])).get(U);
  assert.equal(scope.directoryCodes.includes("28000003"),false,"unlisted directory denied");
  db.students.push({owner_user_id:U,school_id:C,directory_school_code:"28000002",active:true});
  scope=(await loadScopes(db,[U])).get(U);
  assert.deepEqual([...scope.schoolIds],[],"one contradictory row makes entire user's scope empty");
  assert.deepEqual([...scope.directoryCodes],[]);
});

test("listed directory code linked to an inactive or unknown school grants no alert scope",async()=>{
  const db=fakeDb();
  db.directories.push(
    {official_code:"28000004",linked_school_id:C,is_listed:true},
    {official_code:"28000005",linked_school_id:"malformed",is_listed:true},
    {official_code:"28000006",linked_school_id:null,is_listed:true},
  );
  db.schools.find(s=>s.id===C).is_active=false;
  db.students.push(
    {owner_user_id:U,school_id:null,directory_school_code:"28000004",active:true},
    {owner_user_id:U,school_id:null,directory_school_code:"28000005",active:true},
    {owner_user_id:U,school_id:null,directory_school_code:"28000006",active:true},
  );
  const scope=(await loadScopes(db,[U])).get(U);
  assert.equal(scope.directoryCodes.includes("28000004"),false,"inactive linked school denied");
  assert.equal(scope.directoryCodes.includes("28000005"),false,"invalid linked school denied");
  assert.equal(scope.directoryCodes.includes("28000006"),true,"unlinked listed directory remains supported");
  assert.equal(matches(search,listing(null,"28000004"),undefined,activeLinks(scope)),false);
  assert.equal(matches(search,listing(null,"28000005"),undefined,activeLinks(scope)),false);
  assert.equal(matches(search,listing(null,"28000006"),undefined,activeLinks(scope)),true);
});

test("server failures, unbounded pages and forged user identities fail closed",async()=>{
  const db=fakeDb();
  db.errorTable="account_students";
  await assert.rejects(()=>loadScopes(db,[U]),/MULTISCHOOL_ALERT_MEMBERSHIP_UNAVAILABLE/);
  db.errorTable=null;
  await assert.rejects(()=>loadScopes(db,["malformed"]),/MULTISCHOOL_ALERT_RECIPIENT_LIMIT/);
  await assert.rejects(()=>loadScopes(db,Array(201).fill(0).map((_,i)=>
    "abcd"+String(i).padStart(4,"0")+"-1111-4111-8111-111111111111")),
    /MULTISCHOOL_ALERT_RECIPIENT_LIMIT/);
  db.students=Array.from({length:1000},()=>({
    owner_user_id:U,school_id:A,directory_school_code:null,active:true,
  }));
  await assert.rejects(()=>loadScopes(db,[U]),/MULTISCHOOL_ALERT_MEMBERSHIP_UNAVAILABLE/);
});

test("legacy alerts retain their exact single-school behavior",()=>{
  const legacy={...search,community_scope_mode:"single",school_id:A};
  assert.equal(matches(legacy,listing(A)),true);
  assert.equal(matches(legacy,listing(B)),false);
  assert.equal(matches(legacy,listing(A,"28000003")),false,"directory identity stays authoritative");
});

test("new schema is review-only, additive, preserves legacy and rejects mixed modes",()=>{
  const sql=readFileSync("docs/pilot/sql/p0_multischool_alert_dynamic_scope_review_only_20261119.sql","utf8");
  assert.match(sql,/REVIEW ONLY/);
  assert.match(sql,/ADD COLUMN IF NOT EXISTS community_scope_mode text NOT NULL DEFAULT 'single'/);
  assert.match(sql,/community_scope_mode = 'active_family'/);
  assert.match(sql,/CREATE TRIGGER saved_search_family_scope_stamp_before_update_v1/);
  assert.match(sql,/wetudy_internal\.saved_search_preference_stamp_v1\(\)/);
  assert.match(sql,/school_id IS NULL/);
  assert.match(sql,/directory_school_code IS NULL/);
  assert.doesNotMatch(sql,/(?:^|\\n)\\s*(?:DROP TABLE|TRUNCATE|DELETE FROM|UPDATE public\\.saved_searches|INSERT INTO public\\.saved_searches|GRANT|REVOKE)\\b/im);
});

test("both discovery and live delivery re-authorize; notifications stay independently gated",()=>{
  const route=readFileSync("app/api/marketplace/saved-searches/route.ts","utf8");
  const worker=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
  assert.match(route,/WETUDY_MULTISCHOOL_ALERT_SCOPE_ENABLED !== "true"/);
  assert.match(route,/community_scope_mode: "active_family"/);
  assert.match(route,/resolveSingleCommunityAlertContext\(/);
  assert.match(worker,/WETUDY_MULTISCHOOL_ALERT_SCOPE_ENABLED === "true"/);
  assert.match(worker,/WETUDY_MULTISCHOOL_LISTINGS_ENABLED === "true"/);
  assert.match(worker,/legacySearchProjection \+ ", community_scope_mode"/);
  assert.match(worker,/loadCurrentFamilyAlertScopes\(admin,\s*dynamicUsers\.slice\(start, start \+ 150\)\)/);
  assert.match(worker,/loadCurrentFamilyAlertScopes\(admin, deliveryUsers\)/);
  assert.equal((worker.match(/await verifyWorkerRecipients\(/g)||[]).length,2);
  assert.match(worker,/WETUDY_SAVED_SEARCH_ALERTS_ENABLED !== "true"/);
  assert.match(worker,/WETUDY_ALERT_OUTBOX_ENABLED === "true"/);
  assert.match(worker,/saved_searches\.updated_at/);
});
