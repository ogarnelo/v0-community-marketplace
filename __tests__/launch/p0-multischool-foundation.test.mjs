import assert from "node:assert/strict";
import test from "node:test";
import { resolveCommunitySchoolsForUsers } from "../../lib/marketplace/community-school-context.ts";
import { readFileSync } from "node:fs";
const params={
  userIds:["family","inactive","legacy","admin","unlinked"],
  students:[
    {owner_user_id:"family",school_id:"A",active:true},
    {owner_user_id:"family",school_id:"B",active:true},
    {owner_user_id:"family",school_id:"STALE",active:false},
    {owner_user_id:"inactive",school_id:null,active:true},
    {owner_user_id:"legacy",school_id:"OLD",active:false},
  ],
  roles:[{user_id:"admin",school_id:"C",role:"school_admin",active:true}],
  profiles:[
    {id:"family",school_id:"OLDER"},
    {id:"inactive",school_id:"LEGACY"},
    {id:"legacy",school_id:"OLD"},
    {id:"unlinked",school_id:null},
  ],
};
test("two active children grant two schools, but never stale or unrelated schools",()=>{
 const scope=resolveCommunitySchoolsForUsers(params);
 assert.deepEqual(scope.get("family"),["A","B"]);
 assert.deepEqual(scope.get("inactive"),[]);
 assert.deepEqual(scope.get("legacy"),["OLD"]);
 assert.deepEqual(scope.get("admin"),["C"]);
 assert.deepEqual(scope.get("unlinked"),[]);
});
test("multi-school resolver is scoped by user and deduplicates memberships",()=>{
 const scope=resolveCommunitySchoolsForUsers({...params,userIds:["family","stranger"],students:[
   ...params.students,
   {owner_user_id:"family",school_id:"A",active:true},
   {owner_user_id:"stranger",school_id:"SECRET",active:false},
 ]});
 assert.deepEqual(scope.get("family"),["A","B"]);
 assert.deepEqual(scope.get("stranger"),[]);
});
test("database review-only guard protects reassignment and owners",()=>{
 const sql=readFileSync("docs/pilot/sql/p0_multischool_listing_school_guard_review_only_20261119.sql","utf8");
 assert.match(sql,/NEW\\.directory_school_code IS NOT DISTINCT FROM OLD\\.directory_school_code/);
 assert.match(sql,/BEFORE INSERT OR UPDATE OF school_id, directory_school_code/);
 assert.match(sql,/d\\.official_code = NEW\\.directory_school_code/);
 assert.match(sql,/a\\.directory_school_code = NEW\\.directory_school_code/);
 assert.match(sql,/s\\.is_active = true/);
 assert.match(sql,/CREATE TRIGGER validate_listing_school_context/);
 assert.match(sql,/NEW\.seller_id IS DISTINCT FROM actor/);
 assert.match(sql,/NEW\.school_id IS NOT DISTINCT FROM OLD\.school_id/);
 assert.match(sql,/a\.owner_user_id = actor AND a\.active = true/);
 assert.match(sql,/count\(\*\) INTO admin_count/);
 assert.match(sql,/REVOKE ALL ON FUNCTION private\.enforce_listing_school_context/);
});
