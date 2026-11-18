import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const source=readFileSync("lib/reports/school-impact-report.ts","utf8");
const js=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText;
const out={};
vm.runInNewContext(js,{
  exports:out,Date,Intl,Number,TextEncoder,Buffer,
  require:n=>{
    if(n==="server-only")return {};
    if(n==="@/lib/supabase/admin")return {createAdminClient:()=>{throw Error("No SQL permitted")}};
    throw Error("Unexpected dependency "+n);
  },
},{timeout:1800});
test("Madrid November 1 after midnight still October UTC selects October report",()=>{
 const p=out.previousCalendarMonth(new Date("2026-10-31T23:30:00Z"));
 assert.equal(p.key,"2026-10");
 assert.equal(p.start.toISOString(),"2026-10-01T00:00:00.000Z");
 assert.equal(p.end.toISOString(),"2026-11-01T00:00:00.000Z");
 assert.match(p.label,/Octubre(?: de)? 2026/i);
});
test("Madrid August 1 at UTC July 31 selects July report",()=>{
 const p=out.previousCalendarMonth(new Date("2026-07-31T22:30:00Z"));
 assert.equal(p.key,"2026-07");
 assert.equal(p.start.toISOString(),"2026-07-01T00:00:00.000Z");
 assert.equal(p.end.toISOString(),"2026-08-01T00:00:00.000Z");
});
test("Madrid end of month before local midnight still selects previous month",()=>{
 const p=out.previousCalendarMonth(new Date("2026-11-30T22:30:00Z"));
 assert.equal(p.key,"2026-10");
});
test("normal midmonth and January year rollover keep same month identifiers",()=>{
 assert.equal(out.previousCalendarMonth(new Date("2026-11-18T11:00:00Z")).key,"2026-10");
 assert.equal(out.previousCalendarMonth(new Date("2027-01-01T10:00:00Z")).key,"2026-12");
});
