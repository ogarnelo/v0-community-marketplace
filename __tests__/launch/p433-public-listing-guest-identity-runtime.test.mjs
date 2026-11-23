import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts=createRequire(import.meta.url)("typescript");
const read=path=>readFileSync(path,"utf8");
const file="lib/marketplace/public-listing-identity.ts";
const compiled=ts.transpileModule(read(file),{
 fileName:file,reportDiagnostics:true,
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
});
assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
const exp={};
vm.runInNewContext(compiled.outputText,{exports:exp,Promise,Date,Object},{filename:file,timeout:1200});
const project=exp.projectListingForViewer;
const fixture=()=>({
 id:"public-listing-permalink",
 title:"Libro de texto",
 description:"Material escolar",
 sellerId:"SECRET_SELLER_UUID",
 schoolId:"SECRET_PRIVATE_SCHOOL_UUID",
 directorySchoolCode:"DIRECTORY_PRIVATE_CONTEXT",
 postalCode:null,
 photos:[],
 status:"available",
 createdAt:null
});

test("P0 #433: every unauthenticated projection hides seller, school and directory identity",()=>{
 for(const actor of [null,undefined,""]){
  const original=fixture();
  const projected=project(original,actor);
  assert.equal(projected.id,original.id,"public listing permalink must remain available");
  assert.equal(projected.title,original.title);
  assert.equal(projected.status,"available");
  assert.equal(projected.sellerId,null);
  assert.equal(projected.schoolId,null);
  assert.equal(projected.directorySchoolCode,null);
  assert.equal(projected.postalCode,null);
  assert.equal(original.sellerId,"SECRET_SELLER_UUID","do not mutate privileged source");
  assert.ok(!JSON.stringify(projected).includes("SECRET_"));
  assert.ok(!JSON.stringify(projected).includes("DIRECTORY_PRIVATE_CONTEXT"));
 }
});

test("P0 #433: verified sessions retain existing contact and school functions",()=>{
 const row=fixture();
 const projected=project(row,"verified-user-id");
 assert.equal(projected,row,"avoid changing legitimate authenticated data flow");
 assert.equal(projected.sellerId,row.sellerId);
 assert.equal(projected.schoolId,row.schoolId);
 assert.equal(projected.directorySchoolCode,row.directorySchoolCode);
});

test("P0 #433: home and feed both protect guest serialization after server-side enrichment",()=>{
 const home=read("app/marketplace/page.tsx");
 const feed=read("app/api/marketplace/feed/route.ts");
 for(const [label,s] of [["home",home],["feed",feed]]){
  assert.match(s,/import \{ projectListingForViewer \} from "@\/lib\/marketplace\/public-listing-identity"/,label);
  assert.match(s,/projectListingForViewer\(\{[\s\S]*?\}, user\?\.id\)/,label);
  assert.match(s,/postalCode: null/,label+" must not send full postcode");
  assert.match(s,/\.eq\("status", "available"\)/,label+" must still filter available listings");
  assert.doesNotMatch(s,/supabase\.from\("listings"\)/,label+" must use scoped server reader");
 }
 assert.match(home,/const user = authError \? null : authUser/);
 assert.match(feed,/const user = authError \? null : authData\?\.user \?\? null/);
});

test("P0 #433: listing detail does not send guest seller IDs to analytics or contact buttons",()=>{
 const detail=read("app/marketplace/listing/[id]/page.tsx");
 assert.match(detail,/const currentUserId = authError \? null : authData\?\.user\?\.id \|\| null/);
 assert.match(detail,/const relatedListings:[\s\S]*?projectListingForViewer\(\{[\s\S]*?\}, currentUserId\)\)/);
 const direct=(detail.match(/sellerId=\{currentUserId \? listing\.seller_id : null\}/g)||[]);
 assert.equal(direct.length,3,"analytics, desktop contact and mobile contact must never get guest UUID");
 assert.match(detail,/seller\?\.id && currentUserId \? <Link href=\{\`\/profile\/\$\{seller\.id\}\`\}/);
 assert.match(detail,/const sellerName = currentUserId[\s\S]*?seller\?\.user_type === "business"[\s\S]*?: "Miembro de Wetudy"/);
 assert.match(detail,/const isAvailable = listing\.status === "available"/);
 assert.match(detail,/if \(!isAvailable && !isOwnListing\)/);
});

test("P0 #433: guest desktop and mobile Contact buttons still redirect to Auth",()=>{
 const contact=read("components/messages/contact-seller-button.tsx");
 const mobile=read("components/marketplace/mobile-listing-actions.tsx");
 const auth=contact.indexOf("if (!currentUserId)");
 const seller=contact.indexOf("if (!sellerId)");
 const create=contact.indexOf(".from(\"conversations\")");
 assert.ok(auth>=0 && seller>auth && create>seller,"guest must redirect without reading sellerId");
 assert.match(contact,/sellerId: string \| null/);
 assert.match(contact,/router\.push\(\`\$\{authUrl\.pathname\}\$\{authUrl\.search\}\`\)/);
 assert.match(mobile,/\(currentUserId && !sellerId\)/,
   "guest CTA must remain visible even when seller ID is hidden");
 assert.match(mobile,/<ContactSellerButton/);
});

test("P0 #433: no new SQL/DML is necessary for already-installed database ACL",()=>{
 const newHelper=read(file);
 assert.doesNotMatch(newHelper,/supabase|createAdminClient|ALTER|REVOKE|GRANT|SECURITY DEFINER/);
 const detail=read("app/marketplace/listing/[id]/page.tsx");
 assert.match(detail,/isDemoListing\(listing\)/);
});
