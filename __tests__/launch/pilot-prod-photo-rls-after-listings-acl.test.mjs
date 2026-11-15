import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const files=[
 ["home","app/marketplace/page.tsx"],
 ["feed","app/api/marketplace/feed/route.ts"],
 ["school","app/api/marketplace/my-school/route.ts"],
];
test("no SSR listing photo enrichment relies on anon or authenticated RLS",()=>{
 for(const [name,path] of files){
  const s=readFileSync(path,"utf8");
  const photo=s.match(/(?:admin|supabase)\s*\.from\("listing_photos"\)/g)||[];
  assert.ok(photo.length>=1,name+" must load photos");
  assert.ok(photo.every(q=>q.includes("admin")),"must use admin after scoped listings in "+name);
  assert.match(s,/\.eq\("status", "available"\)/,"public listing gate "+name);
  assert.match(s,/postalCode: null/,"no full postal code in client payload "+name);
 }
});
test("school photo query follows verified login and school filtering",()=>{
 const s=readFileSync("app/api/marketplace/my-school/route.ts","utf8");
 const auth=s.indexOf("if (authError || !user)");
 const scope=s.indexOf("const expression = makeMarketplaceSchoolFilter");
 const photo=s.indexOf('admin.from("listing_photos")');
 assert.ok(auth>=0&&scope>auth&&photo>scope);
});
