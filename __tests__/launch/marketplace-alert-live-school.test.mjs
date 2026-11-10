import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { codesForLiveSchoolPage, partitionLiveSchool }
  from "../../lib/marketplace/alert-live-school.mjs";

const route=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
const migration=readFileSync("supabase/migrations/20261110194657_marketplace_school_link_invalidation_v2.sql","utf8");
const fixture=readFileSync("scripts/pilot-marketplace-live-school-relink.sql","utf8");
const code="CENTER-A",school1="00000000-0000-4000-8000-000000000001";
const school2="00000000-0000-4000-8000-000000000002";
const match=(id,search)=>({id,user_id:"10000000-0000-4000-8000-000000000001",
  saved_searches:{notifications_enabled:true,...search}});

// Mirror the authoritative discovery school condition in a tiny fixture.
// The production route passes savedSearchMatchesListing, not this stub.
const sameSchool=(search,listing,_distance,links)=>{
  if (!search.only_my_community) return true;
  const savedCode=search.directory_school_code?.trim()||null;
  const listingCode=listing.directory_school_code?.trim()||null;
  if(savedCode){
    if(listingCode) return savedCode===listingCode;
    return !!links.savedDirectoryLinkedSchoolId &&
      listing.school_id===links.savedDirectoryLinkedSchoolId;
  }
  if(search.school_id){
    if(listingCode){
      return !!links.listingDirectoryLinkedSchoolId &&
        links.listingDirectoryLinkedSchoolId===search.school_id;
    }
    return search.school_id===listing.school_id;
  }
  return false;
};

test("directory-only search relinked from actual listing school must be invalidated",()=>{
  const listing={id:"listing",school_id:school1,directory_school_code:null};
  const page=[match("m1",{only_my_community:true,directory_school_code:code})];
  assert.deepEqual(codesForLiveSchoolPage(page,listing),[code]);
  assert.equal(partitionLiveSchool(page,listing,new Map([[code,school1]]),sameSchool).deliverable.length,1);
  const after=partitionLiveSchool(page,listing,new Map([[code,school2]]),sameSchool);
  assert.deepEqual(after.invalidated.map(x=>x.id),["m1"]);
  assert.equal(after.deliverable.length,0);
});

test("operational-school search relinked from listing directory code is excluded",()=>{
  const listing={id:"listing",school_id:null,directory_school_code:code};
  const page=[match("m2",{only_my_community:true,school_id:school1})];
  assert.deepEqual(codesForLiveSchoolPage(page,listing),[code]);
  assert.equal(partitionLiveSchool(page,listing,new Map([[code,school1]]),sameSchool).deliverable.length,1);
  assert.deepEqual(
    partitionLiveSchool(page,listing,new Map([[code,school2]]),sameSchool)
      .invalidated.map(x=>x.id),["m2"]);
});

test("matching national directory codes stay valid independent of operational link",()=>{
  const listing={id:"listing",school_id:school2,directory_school_code:code};
  const page=[match("m3",{only_my_community:true,directory_school_code:code,school_id:school1})];
  for(const links of [new Map(),new Map([[code,school2]])]){
    assert.deepEqual(partitionLiveSchool(page,listing,links,sameSchool).deliverable.map(x=>x.id),["m3"]);
  }
});

test("unknown school and missing link fail closed; global searches stay eligible",()=>{
  const listing={id:"listing",school_id:school2,directory_school_code:null};
  const page=[
    match("global",{only_my_community:false}),
    match("unknown",{only_my_community:true}),
    match("unlinked",{only_my_community:true,directory_school_code:code}),
  ];
  const res=partitionLiveSchool(page,listing,new Map(),sameSchool);
  assert.deepEqual(res.deliverable.map(x=>x.id),["global"]);
  assert.deepEqual(res.invalidated.map(x=>x.id),["unknown","unlinked"]);
  assert.deepEqual(codesForLiveSchoolPage(page,listing),[code]);
});

test("direct school-id matching uses no directory query and rejects different school",()=>{
  const listing={id:"listing",school_id:school1,directory_school_code:null};
  const page=[
    match("same",{only_my_community:true,school_id:school1}),
    match("different",{only_my_community:true,school_id:school2}),
  ];
  assert.deepEqual(codesForLiveSchoolPage(page,listing),[]);
  const res=partitionLiveSchool(page,listing,new Map(),sameSchool);
  assert.deepEqual(res.deliverable.map(x=>x.id),["same"]);
  assert.deepEqual(res.invalidated.map(x=>x.id),["different"]);
});

test("all 12 delivery recipients use at most 13 codes without global scan",()=>{
  const listing={id:"listing",school_id:school1,directory_school_code:"LISTING-CODE"};
  const page=Array.from({length:12},(_,i)=>match("m"+i,{
    only_my_community:true,directory_school_code:"CODE-"+i,
  }));
  const codes=codesForLiveSchoolPage(page,listing);
  assert.equal(codes.length,13);
  assert.ok(codes.includes("LISTING-CODE"));
  const res=partitionLiveSchool(page,listing,new Map(),sameSchool);
  assert.equal(res.invalidated.length,12);
  assert.throws(()=>partitionLiveSchool(null,listing,new Map(),sameSchool),TypeError);
  assert.throws(()=>partitionLiveSchool(page,listing,{},sameSchool),TypeError);
});

test("worker checks live school before radius and before BOTH channels",()=>{
  assert.match(route,/codesForLiveSchoolPage, partitionLiveSchool/);
  assert.match(route,/partitionLiveSchool\(page, listing, directoryLinks, savedSearchMatchesListing\)/);
  assert.match(route,/schoolValid\.filter\(hasRadiusConstraint\)/);
  assert.match(route,/partitionLiveRadius\(\s*schoolValid, profilePostcodes/);
  assert.equal((route.match(/await verifyWorkerRecipients\(/g)||[]).length,2);
  assert.equal((route.match(/saved_searches!inner\(id, notifications_enabled, updated_at, radius_km, only_my_community, school_id, directory_school_code\)/g)||[]).length,2);
  assert.match(route,/\.in\("official_code", codes\)/);
  assert.match(route,/invalidation_reason: stale\.reason/);
  assert.match(route,/school_link_changed/);
  assert.match(route,/radius_changed/);
  assert.match(route,/\.is\("invalidated_at", null\)/);
  const before=route.indexOf("partitionLiveSchool(page, listing, directoryLinks, savedSearchMatchesListing)");
  const radius=route.indexOf("partitionLiveRadius(\n        schoolValid");
  const email=route.indexOf("await sendTransactionalEmailOnce(");
  assert.ok(before>=0&&radius>before&&email>radius);
  assert.match(route,/WETUDY_ALERT_OUTBOX_ENABLED === "true"/);
});

test("migration accepts only PII-free fixed school and radius reasons",()=>{
  assert.match(migration,/drop constraint if exists saved_search_matches_invalidation_reason_v1_chk/);
  assert.match(migration,/add constraint saved_search_matches_invalidation_reason_v2_chk/);
  assert.match(migration,/invalidation_reason in \('radius_changed', 'school_link_changed'\)/);
  assert.doesNotMatch(migration.replace(/^--.*$/gm,""),/grant\s+|update public\.saved_search_matches|insert into/i);
  assert.match(fixture,/Invalid reason accepted/);
  assert.match(fixture,/school_link_changed/);
});
