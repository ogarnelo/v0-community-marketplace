import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

for(const path of ["app/api/school/impact-report/route.ts",
 "app/api/school/send-impact-report/route.ts"]){
 test(`${path} rechecks active school after report load and before PDF`,()=>{
  const source=readFileSync(path,"utf8");
  const load=source.indexOf("const report = await loadSchoolImpactReport");
  const guard=source.indexOf("if (!report?.school || report.school.is_active !== true)");
  const pdf=source.indexOf("const pdf = renderSchoolImpactPdf");
  assert.ok(load>=0&&guard>load&&pdf>guard);
  assert.match(source.slice(guard,pdf),/status: 403/);
  assert.match(source,/Cache-Control.*private, no-store/);
 });
}
test("manual send verifies report scope before provider call",()=>{
 const source=readFileSync("app/api/school/send-impact-report/route.ts","utf8");
 const guard=source.indexOf("if (!report?.school || report.school.is_active !== true)");
 const provider=source.indexOf("await sendMonthlySchoolImpactEmail");
 assert.ok(provider>guard);
});
