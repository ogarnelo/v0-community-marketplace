import assert from "node:assert/strict";
import test from "node:test";
import { resolveCommunitySchoolsForUsers } from "../../lib/marketplace/community-school-context.ts";
import { savedSearchMatchesListing } from "../../lib/marketplace/saved-search-matching.ts";

const scope = resolveCommunitySchoolsForUsers({
  userIds: ["family", "admin", "legacy", "unlinked"],
  students: [
    { owner_user_id: "family", school_id: "A" },
    { owner_user_id: "family", school_id: "B" },
    { owner_user_id: "legacy", school_id: null },
  ],
  roles: [{ user_id: "admin", school_id: "C", role: "school_admin" }],
  profiles: [
    { id: "family", school_id: "OLD" },
    { id: "legacy", school_id: "OLD" },
    { id: "unlinked", school_id: "E" },
  ],
});
const listing=(school_id)=>({id:school_id||"unknown",title:"Libro Matemáticas",school_id});
const search={id:"s",query:"Matemáticas",only_my_community:true,school_id:"A"};
test("family with two active schools gets both communities, ignoring old profile",()=>{
  assert.deepEqual(scope.get("family"),["A","B"]);
  assert.deepEqual(scope.get("admin"),["C"]);
  assert.deepEqual(scope.get("legacy"),[]);
  assert.deepEqual(scope.get("unlinked"),["E"]);
});
test("community saved search matches both schools and rejects unrelated schools",()=>{
  for (const schoolId of ["A","B"]) assert.equal(savedSearchMatchesListing({...search,school_ids:scope.get("family")},listing(schoolId)),true);
  for (const schoolId of ["C",null]) assert.equal(savedSearchMatchesListing({...search,school_ids:scope.get("family")},listing(schoolId)),false);
});
test("without community filter both own and other school listings remain visible to matcher",()=>{
  for (const schoolId of ["A","B","C"]) assert.equal(savedSearchMatchesListing({...search,only_my_community:false},listing(schoolId)),true);
});
test("no linked school never broadens a community search to all listings",()=>{
  assert.equal(savedSearchMatchesListing({...search,school_ids:scope.get("legacy")},listing("A")),false);
});
test("active profile fallback is only used when no active students are present",()=>{
  assert.deepEqual(scope.get("legacy"),[]);
  assert.deepEqual(scope.get("unlinked"),["E"]);
});
test("browser filters include all current community schools, and distance mode does not exclude own school",()=>{
  const page=await import("node:fs").then(({readFileSync})=>readFileSync(new URL("../../components/marketplace/marketplace-client.tsx",import.meta.url),"utf8"));
  assert.match(page,/currentUserSchoolIds\.includes\(l\.schoolId\)/);
  assert.match(page,/!onlyMyCommunity && maxDistanceKm !== Infinity/);
});
