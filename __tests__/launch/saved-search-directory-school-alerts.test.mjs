import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const read=(path)=>readFileSync(path,"utf8");
const savedRoute=read("app/api/marketplace/saved-searches/route.ts");
const matchRoute=read("app/api/marketplace/listings/match-saved-searches/route.ts");
const client=read("components/marketplace/marketplace-client.tsx");
const migration=read("supabase/migrations/20261110094951_saved_searches_directory_school_context.sql");
const exports={};
runInNewContext(ts.transpileModule(
  read("lib/marketplace/saved-search-matching.ts"),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}
).outputText,{exports});
const {savedSearchMatchesListing}=exports;
const listing={id:"a",title:"Polo azul talla 12",category:"Uniformes",type:"sale"};
const codeA="04000123",codeB="28000123";
const schoolA="11111111-1111-4111-8111-111111111111",schoolB="22222222-2222-4222-8222-222222222222";
const base={id:"s",query:"Polo",only_my_community:true};

test("unactivated national directory alerts match only the identical official centre",()=>{
  const search={...base,school_id:null,directory_school_code:codeA};
  assert.equal(savedSearchMatchesListing(search,{...listing,directory_school_code:codeA,school_id:null}),true);
  assert.equal(savedSearchMatchesListing(search,{...listing,directory_school_code:codeB,school_id:null}),false);
  assert.equal(savedSearchMatchesListing(search,{...listing,directory_school_code:codeB,school_id:schoolA}),false,
    "An authoritative listing directory code must override stale school_id");
  assert.equal(savedSearchMatchesListing(search,{...listing,directory_school_code:null,school_id:schoolA}),false,
    "Directory-only searches cannot match an unrelated operational school");
  assert.equal(savedSearchMatchesListing({...base,school_id:null,directory_school_code:null},listing),false);
});

test("directory and operational school can cross-match only through verified directory link",()=>{
  const savedDirectory={...base,directory_school_code:codeA,school_id:null};
  const operationalListing={...listing,school_id:schoolA,directory_school_code:null};
  assert.equal(savedSearchMatchesListing(savedDirectory,operationalListing),false);
  assert.equal(savedSearchMatchesListing(savedDirectory,operationalListing,undefined,
    {savedDirectoryLinkedSchoolId:schoolA}),true);
  assert.equal(savedSearchMatchesListing(savedDirectory,operationalListing,undefined,
    {savedDirectoryLinkedSchoolId:schoolB}),false);

  const savedOperational={...base,school_id:schoolA,directory_school_code:null};
  const directoryListing={...listing,school_id:null,directory_school_code:codeA};
  assert.equal(savedSearchMatchesListing(savedOperational,directoryListing),false);
  assert.equal(savedSearchMatchesListing(savedOperational,directoryListing,undefined,
    {listingDirectoryLinkedSchoolId:schoolA}),true);
  assert.equal(savedSearchMatchesListing(savedOperational,directoryListing,undefined,
    {listingDirectoryLinkedSchoolId:schoolB}),false);
  assert.equal(savedSearchMatchesListing(savedOperational,{...listing,school_id:schoolA}),true);
  assert.equal(savedSearchMatchesListing(savedOperational,{...listing,school_id:schoolB}),false);
});

test("school context does not weaken radius, product filters or global searches",()=>{
  const search={...base,school_id:null,directory_school_code:codeA,radius_km:10,
    category:"Uniformes"};
  const located={...listing,school_id:null,directory_school_code:codeA};
  assert.equal(savedSearchMatchesListing(search,located,5),true);
  assert.equal(savedSearchMatchesListing(search,located,15),false);
  assert.equal(savedSearchMatchesListing(search,located,undefined),false);
  assert.equal(savedSearchMatchesListing(search,{...located,category:"Libros"},1),false);
  assert.equal(savedSearchMatchesListing({id:"g",query:"Polo",only_my_community:false},listing),true);
});

test("school identity is derived from selected student/role, not user-supplied URL",()=>{
  assert.match(savedRoute,/select\("school_id,directory_school_code,is_primary,sort_order,created_at"\)/);
  assert.match(savedRoute,/primaryStudentContext\?\.directory_school_code\?\.trim\(\)/);
  assert.match(savedRoute,/schoolAdminRole\?\.school_id\?\.trim\(\)/);
  assert.match(savedRoute,/primaryStudentContext\s*\?\s*primaryStudentContext\.school_id\?\.trim\(\) \|\| null/);
  assert.match(savedRoute,/school_context_required/);
  assert.match(savedRoute,/directory_school_code: directorySchoolCode/);
  assert.doesNotMatch(savedRoute,/body\.directorySchoolCode|body\.directory_school_code/);
  assert.match(client,/response\.status === 409/);
  assert.match(client,/Selecciona primero tu colegio en Mi cuenta/);
});

test("publishing checks exact directory codes and linked schools once, not one query per matching search",()=>{
  assert.match(matchRoute,/school_id, directory_school_code, postal_code, status/);
  assert.match(matchRoute,/only_my_community, school_id, directory_school_code, radius_km/);
  assert.match(matchRoute,/\.from\("school_directory"\)/);
  assert.match(matchRoute,/\.select\("official_code,linked_school_id"\)/);
  assert.match(matchRoute,/directoryCodes\.slice\(start, start \+ 150\)/);
  assert.match(matchRoute,/schoolLinksFor\(search\)/);
  assert.match(matchRoute,/savedSearchMatchesListing\(\{ \.\.\.search, radius_km: null \}, listing/);
  assert.match(matchRoute,/savedSearchMatchesListing\(/);
  assert.match(matchRoute,/onConflict: "saved_search_id,listing_id"/);
  assert.match(matchRoute,/sendTransactionalEmailOnce\(/);
});

test("content prefilter preserves matches while avoiding unrelated school and geo lookups",()=>{
  const scenario=[
    {...base,id:"same-school",directory_school_code:codeA,category:"Uniformes"},
    {...base,id:"other-school",directory_school_code:codeB,category:"Uniformes"},
    {...base,id:"other-product",directory_school_code:codeA,category:"Libros"},
    {...base,id:"too-far",directory_school_code:codeA,category:"Uniformes",radius_km:10},
    {...base,id:"nearby",directory_school_code:codeA,category:"Uniformes",radius_km:30},
    {id:"global",query:"Polo",only_my_community:false},
  ];
  const item={...listing,directory_school_code:codeA,school_id:null};
  const distance=(search)=>search.radius_km ? 15 : undefined;
  const before=scenario.filter(search=>savedSearchMatchesListing(search,item,distance(search)))
    .map(search=>search.id);
  const contentCandidates=scenario.filter(search=>savedSearchMatchesListing(
    {...search,only_my_community:false,radius_km:null},item));
  const after=contentCandidates.filter(search=>savedSearchMatchesListing(search,item,distance(search)))
    .map(search=>search.id);
  assert.deepEqual(before,after);
  assert.deepEqual(after,["same-school","nearby","global"]);
  assert.ok(contentCandidates.length<scenario.length);
  assert.match(matchRoute,/const contentCandidates = \(savedSearches \|\| \[\]\)\.filter/);
  assert.match(matchRoute,/\.\.\.search, only_my_community: false, radius_km: null/);
  assert.match(matchRoute,/const radiusCandidates = contentCandidates\.filter/);
  assert.match(matchRoute,/matches = contentCandidates/);
  assert.match(matchRoute,/if \(!isWorkerDelivery\) \{/);
  assert.match(matchRoute,/const matchedSearchIds = new Set/);
  assert.doesNotMatch(matchRoute,/matches\.some\(\(match\)/);
});

test("schema only adds nullable official-directory reference, preserving existing RLS/centres",()=>{
  assert.match(migration,/add column if not exists directory_school_code text/);
  assert.match(migration,/references public\.school_directory\(official_code\) on delete set null/);
  assert.match(migration,/saved_searches_one_school_reference_chk/);
  assert.match(migration,/school_id is null or directory_school_code is null/);
  assert.doesNotMatch(migration,/(insert into|update|delete from)\s+public\.(listings|schools|school_directory|account_students|profiles|saved_searches)/i);
  assert.doesNotMatch(migration,/disable row level security|create policy|grant /i);
});
