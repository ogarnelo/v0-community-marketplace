import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

// NEVER allow any database except the ephemeral localhost service.
const url = new URL(process.env.DATABASE_URL || "");
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
  throw new Error("Refusing to run benchmark against a nonlocal database");
}
if (url.pathname !== "/wetudy_geo") throw new Error("Refusing unexpected benchmark database name");

const psql = (sql) => execFileSync("psql", [
  "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
  process.env.DATABASE_URL, "-c", sql,
], { encoding: "utf8", timeout: 90_000, maxBuffer: 4 * 1024 * 1024 }).trim();

const count = (sql) => {
  const result = Number(psql(sql));
  assert.ok(Number.isFinite(result));
  return result;
};
const nearSql = (offset=0) =>
  "select * from public.marketplace_nearest_listing_page_v1(" +
  "p_postal_code=>'28001', p_sort=>'distance', p_offset=>" + offset + ", p_page_size=>61)";
const radialSql = (radius) =>
  "select * from public.marketplace_nearby_listing_page_v1(" +
  "p_postal_code=>'28001', p_radius_km=>" + radius + ", p_sort=>'distance', p_page_size=>61)";

const available = count("select count(*) from public.listings where status='available'");
assert.ok(available >= 5000);
assert.equal(count("select count(*) from (" + nearSql() + ") q"), 61);
const lastOffset = Math.floor((available - 1) / 60) * 60;
assert.equal(count("select count(*) from (" + nearSql(lastOffset) + ") q"),
  available-lastOffset);
assert.ok(count("select count(*) from (" + nearSql(lastOffset) +
  ") q where distance_km is null") > 0,
  "Unknown postcodes must remain at the end, not be silently removed");
assert.equal(count("select count(*) from public.marketplace_nearest_listing_page_v1(" +
  "p_postal_code=>'28001', p_sort=>'newest')"), 0,
  "The nearest-only RPC must not silently implement other sort modes");
assert.equal(count("select count(*) from public.marketplace_nearest_listing_page_v1(" +
  "p_postal_code=>'99999', p_sort=>'distance')"), 0,
  "Unknown viewer postal code must have no locations");
assert.equal(count(
  "select count(*) from ("+nearSql(0).replace("p_page_size=>61","p_page_size=>60")+
  ") a inner join ("+nearSql(60).replace("p_page_size=>61","p_page_size=>60")+
  ") b using (listing_id)"),0,"Adjacent pages must not duplicate listings");

const checkAcl = count(
  "select case when " +
  "not has_function_privilege('anon','public.marketplace_nearest_listing_page_v1(text,integer,text,text,text,text,text,text,timestamptz,numeric,numeric,text,integer,integer)','execute')" +
  " and not has_function_privilege('authenticated','public.marketplace_nearest_listing_page_v1(text,integer,text,text,text,text,text,text,timestamptz,numeric,numeric,text,integer,integer)','execute')" +
  " and has_function_privilege('service_role','public.marketplace_nearest_listing_page_v1(text,integer,text,text,text,text,text,text,timestamptz,numeric,numeric,text,integer,integer)','execute')" +
  " then 1 else 0 end"
);
assert.equal(checkAcl,1,"RPC permissions must not expose internal geospatial search to browser roles");

const scenarios = [
  ["nearest_global",nearSql()],
  ["radius_10km",radialSql(10)],
  ["radius_50km",radialSql(50)],
  ["radius_200km",radialSql(200)],
];
const measured = [];
for (const [label, query] of scenarios) {
  for (let warm=0;warm<2;warm++) psql("explain (analyze, format json) " + query);
  const times=[];
  for (let iteration=0;iteration<10;iteration++) {
    const started=performance.now();
    const data=JSON.parse(psql("explain (analyze, buffers, format json) " + query));
    const sqlMs=Number(data?.[0]?.["Execution Time"]);
    assert.ok(sqlMs >= 0 && Number.isFinite(sqlMs), "Missing SQL execution time");
    times.push(sqlMs);
    if(performance.now()-started>90_000)throw new Error("Query unexpectedly long");
  }
  times.sort((a,b)=>a-b);
  const p50=times[Math.ceil(times.length*0.50)-1];
  const p95=times[Math.ceil(times.length*0.95)-1];
  measured.push({scenario:label,p50_ms:p50,p95_ms:p95});
  console.log(label,"Postgres 17/PostGIS isolated: p50",p50.toFixed(2),
    "ms, p95",p95.toFixed(2),"ms; n",times.length);
}
const summary = [
  "## WETUDY · 6,000 synthetic listings in disposable PostGIS 17",
  "Dataset: "+available+" available listings, all synthetic; no real profiles or schools.",
  "",
  "| Query | p50 SQL (ms) | p95 SQL (ms) |",
  "|---|---:|---:|",
  ...measured.map(x=>"| "+x.scenario+" | "+x.p50_ms.toFixed(2)+" | "+x.p95_ms.toFixed(2)+" |"),
  "",
  "These are CI service timings, not Supabase production SLOs or USD billing.",
  "",
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
console.log("OK: deterministic synthetic fixture; SQL permissions, ordering, pages and limits checked.");
