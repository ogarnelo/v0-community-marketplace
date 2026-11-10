import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const school = readFileSync("app/api/marketplace/my-school/route.ts", "utf8");
const client = readFileSync("components/marketplace/marketplace-client.tsx", "utf8");
const page = readFileSync("app/marketplace/page.tsx", "utf8");

test("COUNT(*) is only requested for an initial unfiltered school page", () => {
  assert.match(school, /const needsTotal = offset === 0 && !hasServerMarketplaceFilters\(filters\)/);
  assert.match(school, /select\(FIELDS, needsTotal \? \{ count: "exact" \} : \{\}\)/);
  assert.match(school, /\.range\(offset, offset \+ PAGE_SIZE\)/);
  assert.match(school, /const hasMore = pageRows.length > PAGE_SIZE/);
  assert.match(school, /const rows = pageRows.slice\(0, PAGE_SIZE\)/);
  assert.match(school, /total: needsTotal \? count \?\? null : null/);
  assert.doesNotMatch(school, /hasMore: offset \+ listings.length < total/);
  assert.match(client, /if \(!requestKey && typeof payload.total === "number"\) setSchoolCount\(payload.total\)/);
  assert.doesNotMatch(client, /if \(!requestKey\) setSchoolCount\(payload.total \?\? null\)/);
  assert.match(page, /initialCommunityListingCount=\{communityListingCount\}/);
});

test("lookahead school pagination visits all synthetic listings once", () => {
  for (const total of [0,1,59,60,61,119,120,121,181,3071]) {
    const rows=Array.from({length:total}, (_,i)=>i);
    const collected=[];
    let pageNumber=0;
    for (let offset=0;offset<=total;offset+=60) {
      const response=rows.slice(offset,offset+61);
      const hasMore=response.length>60;
      collected.push(...response.slice(0,60));
      if (!hasMore) break;
      pageNumber++;
      assert.ok(pageNumber<100, "Pagination did not terminate");
    }
    assert.deepEqual(collected,rows,"No duplicated or missing school listings for "+total);
  }
});
