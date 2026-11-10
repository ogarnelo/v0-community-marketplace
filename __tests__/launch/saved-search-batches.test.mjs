import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadAllSortedPages, batchAlertItems } from "../../lib/marketplace/saved-search-batches.mjs";

const source=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");

const fakeId=(n)=>n.toString(16).padStart(32,"0")
  .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");

test("2,407 searches are all scanned after the first 1,000, with one bounded query per page", async () => {
  const items=Array.from({length:2407},(_,i)=>({id:fakeId(i+1),user_id:fakeId(i+10000)}));
  let calls=0;
  const result=await loadAllSortedPages(async (last,limit)=>{
    calls++;
    assert.equal(limit,200);
    const next=items.filter(x=>last===null||x.id>last).slice(0,limit);
    return next;
  });
  assert.equal(result.length,2407);
  assert.equal(calls,13);
  assert.equal(new Set(result.map(x=>x.id)).size,2407);
  assert.deepEqual(result,items);
});

test("empty, exact-page-size and one-extra-row boundaries have no omissions",async()=>{
  for(const n of [0,1,149,199,200,201,400,401,999,1000,1001,3000]){
    const rows=Array.from({length:n},(_,i)=>({id:fakeId(i+1)}));
    let calls=0;
    const actual=await loadAllSortedPages(async (cursor,limit)=>{
      calls++;
      return rows.filter(x=>cursor===null||x.id>cursor).slice(0,limit);
    });
    assert.deepEqual(actual,rows,"lost/duplicated search for size "+n);
    assert.equal(calls,Math.floor(n/200)+1);
  }
});

test("malformed page or nonadvancing cursor must fail rather than silently lose alerts",async()=>{
  await assert.rejects(loadAllSortedPages(async()=>[{id:"b"},{id:"a"}],2),/strictly ordered/);
  await assert.rejects(loadAllSortedPages(async()=>"invalid",20),/Invalid saved-search page/);
  await assert.rejects(loadAllSortedPages(async()=>Array.from({length:201},(_,i)=>({id:fakeId(i)})),200),/Invalid saved-search page/);
  await assert.rejects(loadAllSortedPages(async()=>[],0),RangeError);
});

test("upserts, pending notifications and email lookups stay within 150 IDs",()=>{
  const sourceMatches=Array.from({length:2407},(_,i)=>({saved_search_id:fakeId(i+1)}));
  const groups=batchAlertItems(sourceMatches);
  assert.equal(groups.length,17);
  assert.ok(groups.every(x=>x.length<=150 && x.length>0));
  assert.equal(groups.flat().length,sourceMatches.length);
  assert.deepEqual(groups.flat(),sourceMatches);
  assert.deepEqual(batchAlertItems([]),[]);
  assert.throws(()=>batchAlertItems(sourceMatches,0),RangeError);
  assert.throws(()=>batchAlertItems(sourceMatches,501),RangeError);
});

test("route uses UUID keyset pagination, bounded matching and existing idempotency",()=>{
  assert.match(source,/loadAllSortedPages\(loadSearches\)/);
  assert.match(source,/const loadSearches = async \(afterId: string \| null, limit: number\)/);
  assert.match(source,/\.order\("id", \{ ascending: true \}\)/);
  assert.match(source,/\.limit\(limit\)/);
  assert.match(source,/if \(afterId\) query = query\.gt\("id", afterId\)/);
  assert.doesNotMatch(source,/const \{ data: savedSearches, error: searchesError \}/);
  assert.equal((source.match(/for \(const batch of batchAlertItems\(matches\)\)/g)||[]).length,1);
  assert.equal((source.match(/loadPendingDeliveryRows\(/g)||[]).length,2);
  assert.match(source,/onConflict: "saved_search_id,listing_id", ignoreDuplicates: true/);
  assert.match(source,/createNotificationOnce\(/);
  assert.match(source,/sendTransactionalEmailOnce\(/);
  assert.match(source,/saved-search-match\/\$\{match.id\}/);
});
