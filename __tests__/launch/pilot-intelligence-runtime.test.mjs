import assert from "node:assert/strict";
import test from "node:test";
import { isCurrentCourseAlert } from "../../lib/demand/course-alert-eligibility.ts";
import { getSchoolMemberIds, countSchoolStudents } from "../../lib/reports/school-membership.ts";

const USER = "family-a", STUDENT = "student-a", DEMAND = "demand-a";
function fixture() {
  return {
    search: { user_id: USER, demand_request_id: DEMAND, school_id: "school-a" },
    demand: { id: DEMAND, user_id: USER, source: "course_need", status: "open", school_id: "school-a", grade_level: "5P" },
    need: { owner_user_id: USER, student_id: STUDENT, demand_request_id: DEMAND, status: "active", academic_year: "2026-2027" },
    student: { id: STUDENT, owner_user_id: USER, active: true, school_id: "school-a", grade_level: "5P", academic_year: "2026-2027" },
  };
}
const allowed = (f) => isCurrentCourseAlert(f.search, f.demand, f.need, f.student);

test("valid and active educational alerts are allowed", () => assert.equal(allowed(fixture()), true));
test("inactive student prevents notification", () => { const f=fixture(); f.student.active=false; assert.equal(allowed(f),false); });
test("stale saved-search school prevents notification", () => { const f=fixture(); f.search.school_id="school-b"; assert.equal(allowed(f),false); });
test("changed school prevents notification", () => { const f=fixture(); f.student.school_id="school-b"; assert.equal(allowed(f),false); });
test("changed grade prevents notification", () => { const f=fixture(); f.student.grade_level="6P"; assert.equal(allowed(f),false); });
test("changed academic year prevents notification", () => { const f=fixture(); f.student.academic_year="2027-2028"; assert.equal(allowed(f),false); });
test("archived need prevents notification", () => { const f=fixture(); f.need.status="archived"; assert.equal(allowed(f),false); });
test("dismissed demand prevents notification", () => { const f=fixture(); f.demand.status="dismissed"; assert.equal(allowed(f),false); });
test("owner mismatch prevents notification", () => { const f=fixture(); f.student.owner_user_id="other"; assert.equal(allowed(f),false); });
test("missing records fail closed", () => {
  const f=fixture();
  assert.equal(isCurrentCourseAlert(f.search,undefined,f.need,f.student),false);
  assert.equal(isCurrentCourseAlert(f.search,f.demand,undefined,f.student),false);
  assert.equal(isCurrentCourseAlert(f.search,f.demand,f.need,undefined),false);
});
test("malformed demand/source prevents notification", () => { const f=fixture(); f.demand.source="saved_search"; assert.equal(allowed(f),false); });

const profiles=[
  { id:"family-a", school_id:"school-a" },
  { id:"family-b", school_id:"school-a" },
  { id:"family-c", school_id:"school-b" },
  { id:"admin-a", school_id:null },
];
const students=[
  { owner_user_id:"family-a", school_id:"school-a" },
  { owner_user_id:"family-a", school_id:"school-a" },
  { owner_user_id:"family-a", school_id:"school-b" },
  { owner_user_id:"family-c", school_id:"school-b" },
];
const admins=[{ user_id:"admin-a" }];

test("AMPA counts distinct family accounts, not students",()=>{
  const ids=getSchoolMemberIds({schoolId:"school-a",profiles,activeStudents:students,schoolAdmins:admins});
  assert.deepEqual([...ids].sort(),["admin-a","family-a","family-b"]);
  assert.equal(countSchoolStudents("school-a",students),2);
});
test("multi-school families count once in each associated school",()=>{
  const ids=getSchoolMemberIds({schoolId:"school-b",profiles,activeStudents:students,schoolAdmins:[]});
  assert.deepEqual([...ids].sort(),["family-a","family-c"]);
  assert.equal(countSchoolStudents("school-b",students),2);
});
test("a family with active student contexts does not fall back to an old profile school",()=>{
  const ids=getSchoolMemberIds({
    schoolId:"school-a",
    profiles:[{id:"family-c",school_id:"school-a"}],
    activeStudents:[{owner_user_id:"family-c",school_id:"school-b"}],
    schoolAdmins:[]
  });
  assert.equal(ids.size,0);
});
test("federation union deduplicates families across schools",()=>{
  const a=getSchoolMemberIds({schoolId:"school-a",profiles,activeStudents:students,schoolAdmins:admins});
  const b=getSchoolMemberIds({schoolId:"school-b",profiles,activeStudents:students,schoolAdmins:[]});
  const federation=new Set([...a,...b]);
  assert.equal(a.size,3);
  assert.equal(b.size,2);
  assert.equal(federation.size,4);
});
