import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {resolve} from "node:path";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const FILE="app/api/marketplace/listing-draft/route.ts";
function api({user={id:"family-A"}, dbError=false, readError=false, storageError=false, draft=null}={}){
  const records={admin:0,logs:[],removed:[],events:[]};
  const db={auth:{getUser:async()=>({data:{user}})}};
  const error=dbError?{message:"PRIVATE SQL failure / password-hash: DO_NOT_LEAK"}:null;
  const builder=()=>({
    photosOnly:false,
    select(columns){this.photosOnly=columns==="photos";return this;},
    eq(){return this;},
    upsert(){records.events.push("db_upsert");return this;},
    delete(){records.events.push("db_delete");return this;},
    async maybeSingle(){return {data:draft,error:this.photosOnly?(readError?{message:"READ_PRIVATE_DO_NOT_LEAK"}:null):error};},
    async single(){return {data:dbError?null:{id:"draft-id",payload:{title:"test"},photos:[]},error};},
    then(resolve,reject){return Promise.resolve({error}).then(resolve,reject);}
  });
  const admin={
    from(name){assert.equal(name,"listing_drafts");records.admin++;return builder();},
    storage:{from(){return {
      async remove(paths){records.events.push("storage_remove");records.removed.push(...paths);return {error:storageError?
        {message:"PRIVATE STORAGE SQL failure DO_NOT_LEAK"}:null};}
    };}}
  };
  const fakeNext={NextResponse:{json(body,opts={}){
    return new Response(JSON.stringify(body),{status:opts.status??200,headers:opts.headers??{}});
  }}};
  const source=readFileSync(resolve(process.cwd(),FILE),"utf8");
  const parsed=ts.transpileModule(source,{fileName:FILE,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true},
    reportDiagnostics:true});
  assert.equal((parsed.diagnostics||[]).filter(e=>e.category===ts.DiagnosticCategory.Error).length,0);
  const exports={};
  const modules={
    "next/server":fakeNext,
    "@/lib/supabase/server":{createClient:async()=>db},
    "@/lib/supabase/admin":{createAdminClient:()=>admin},
  };
  vm.runInNewContext(parsed.outputText,{exports,require:s=>{if(!(s in modules))throw Error("unexpected import");return modules[s];},
    Request,Response,URL,Buffer,console:{error:(...items)=>records.logs.push(items)}},
    {filename:FILE,timeout:2000});
  return {route:exports,records};
}
function req(method,body={}){
  return new Request("http://synthetic.invalid/api/marketplace/listing-draft",{
    method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
  });
}
test("draft auth gate rejects unauthenticated GET/PUT/DELETE before admin",async()=>{
  const {route,records}=api({user:null});
  assert.equal((await route.GET()).status,401);
  assert.equal((await route.PUT(req("PUT",{payload:{title:"book"}}))).status,401);
  assert.equal((await route.DELETE(req("DELETE"))).status,401);
  assert.equal(records.admin,0);
});
test("successful authenticated draft GET never allows cache reuse",async()=>{
  const {route}=api({draft:{id:"draft-1",photos:[],payload:{title:"fixture"}}});
  const r=await route.GET();
  assert.equal(r.status,200);
  assert.match(r.headers.get("cache-control")??"",/private, no-store/);
  assert.equal((await r.json()).draft.id,"draft-1");
});
test("database GET and PUT errors never return privileged details",async()=>{
  const {route,records}=api({dbError:true});
  const get=await route.GET();
  assert.equal(get.status,500);
  assert.equal(JSON.stringify(await get.json()).includes("DO_NOT_LEAK"),false);
  const put=await route.PUT(req("PUT",{payload:{title:"fixture"}}));
  assert.equal(put.status,500);
  assert.equal(JSON.stringify(await put.json()).includes("DO_NOT_LEAK"),false);
  assert.equal(JSON.stringify(records.logs).includes("DO_NOT_LEAK"),false);
});
test("draft DELETE storage error never reflects backend details",async()=>{
  const user={id:"family-A"};
  const {route}=api({user,storageError:true,draft:{
    photos:[{path:"family-A/drafts/photo-1",url:"https://fixture.invalid/photo"}]
  }});
  const resp=await route.DELETE(req("DELETE",{preservePhotoPaths:[]}));
  assert.equal(resp.status,200);
  assert.equal(JSON.stringify(await resp.json()).includes("DO_NOT_LEAK"),false);
});
test("draft PUT cleans only own paths and never logs raw storage failure",async()=>{
  const {route,records}=api({storageError:true,draft:{
    photos:[
      {path:"family-A/drafts/own-photo",url:"https://fixture.invalid/own"},
      {path:"other-family/drafts/private",url:"https://fixture.invalid/private"},
    ]
  }});
  const resp=await route.PUT(req("PUT",{payload:{title:"fixture"}}));
  assert.equal(resp.status,200);
  assert.deepEqual(records.removed,["family-A/drafts/own-photo"]);
  assert.deepEqual(records.logs,[["listing_draft_storage_cleanup_failed"]]);
});

test("all draft response paths disallow cache reuse, including 401, 400, 413, 500 and DELETE",async()=>{
  const assertPrivate=(r)=>assert.match(r.headers.get("cache-control")??"",/private, no-store/);
  const anonymous=api({user:null}).route;
  for (const r of [await anonymous.GET(),await anonymous.PUT(req("PUT")),await anonymous.DELETE(req("DELETE"))]) assertPrivate(r);
  const valid=api().route;
  assertPrivate(await valid.GET());
  assertPrivate(await valid.PUT(req("PUT",{payload:null})));
  assertPrivate(await valid.PUT(req("PUT",{payload:{x:"a".repeat(32001)}})));
  assertPrivate(await valid.PUT(req("PUT",{payload:{title:"fixture"}})));
  assertPrivate(await valid.DELETE(req("DELETE")));
  const failed=api({dbError:true}).route;
  assertPrivate(await failed.GET());
  assertPrivate(await failed.PUT(req("PUT",{payload:{title:"fixture"}})));
  assertPrivate(await failed.DELETE(req("DELETE")));
  const storageFailed=api({storageError:true,draft:{photos:[{path:"family-A/drafts/photo-1",url:"https://fixture.invalid/photo"}]}}).route;
  assertPrivate(await storageFailed.DELETE(req("DELETE")));
});

test("PUT never removes old draft photos when DB upsert fails",async()=>{
  const {route,records}=api({dbError:true,draft:{
    photos:[{path:"family-A/drafts/keep.jpg",url:"https://fixture.invalid/keep"}]
  }});
  const response=await route.PUT(req("PUT",{payload:{title:"new"}}));
  assert.equal(response.status,500);
  assert.deepEqual(records.removed,[]);
  assert.deepEqual(records.events,["db_upsert"]);
});
test("PUT removes abandoned storage objects only after DB successfully saves",async()=>{
  const {route,records}=api({draft:{
    photos:[{path:"family-A/drafts/old.jpg",url:"https://fixture.invalid/old"}]
  }});
  const response=await route.PUT(req("PUT",{payload:{title:"new"},photos:[]}));
  assert.equal(response.status,200);
  assert.deepEqual(records.events,["db_upsert","storage_remove"]);
  assert.deepEqual(records.removed,["family-A/drafts/old.jpg"]);
});

test("DELETE never removes previously referenced photos when the DB delete fails",async()=>{
  const {route,records}=api({dbError:true,draft:{
    photos:[{path:"family-A/drafts/photo-1",url:"https://fixture.invalid/photo"}]
  }});
  const response=await route.DELETE(req("DELETE",{preservePhotoPaths:[]}));
  assert.equal(response.status,500);
  assert.deepEqual(records.removed,[]);
  assert.deepEqual(records.events,["db_delete"]);
});
test("DELETE removes only own discarded objects after DB delete succeeds",async()=>{
  const {route,records}=api({draft:{photos:[
    {path:"family-A/drafts/photo-1",url:"https://fixture.invalid/photo"},
    {path:"family-A/drafts/keep",url:"https://fixture.invalid/keep"},
    {path:"other-family/drafts/foreign",url:"https://fixture.invalid/foreign"}
  ]}});
  const response=await route.DELETE(req("DELETE",{
    preservePhotoPaths:["family-A/drafts/keep","other-family/drafts/foreign"]
  }));
  assert.equal(response.status,200);
  assert.deepEqual(records.events,["db_delete","storage_remove"]);
  assert.deepEqual(records.removed,["family-A/drafts/photo-1"]);
});
test("DELETE Storage failure after DB deletion does not reflect internals",async()=>{
  const {route,records}=api({storageError:true,draft:{
    photos:[{path:"family-A/drafts/old",url:"https://fixture.invalid/old"}]
  }});
  const response=await route.DELETE(req("DELETE"));
  assert.equal(response.status,200);
  assert.deepEqual(records.events,["db_delete","storage_remove"]);
  assert.deepEqual(records.logs,[["listing_draft_storage_cleanup_failed"]]);
  assert.equal(JSON.stringify(await response.json()).includes("DO_NOT_LEAK"),false);
});

test("PUT fails closed on existing-photo lookup error without upsert or storage cleanup",async()=>{
  const {route,records}=api({readError:true,draft:{photos:[{path:"family-A/drafts/one",url:"https://fixture.invalid/one"}]}});
  const response=await route.PUT(req("PUT",{payload:{title:"new"},photos:[]}));
  assert.equal(response.status,500);
  assert.equal(JSON.stringify(await response.json()).includes("READ_PRIVATE_DO_NOT_LEAK"),false);
  assert.deepEqual(records.events,[]);
  assert.equal(records.admin,1);
});
test("DELETE fails closed on existing-photo lookup error without deleting record or files",async()=>{
  const {route,records}=api({readError:true});
  const response=await route.DELETE(req("DELETE",{preservePhotoPaths:[]}));
  assert.equal(response.status,500);
  assert.equal(JSON.stringify(await response.json()).includes("READ_PRIVATE_DO_NOT_LEAK"),false);
  assert.deepEqual(records.events,[]);
  assert.equal(records.admin,1);
});

test("PUT rejects foreign and malformed photo references before admin access",async()=>{
  const cases=[
    [{path:"family-B/drafts/foreign",url:"https://fixture.invalid/file"}],
    [{path:"family-A/drafts/own",url:""}],
    [{path:"family-A/drafts/own",url:"https://fixture.invalid/file"},
     {path:"family-A/drafts/own",url:"https://fixture.invalid/duplicate"}],
    Array.from({length:9},(_,i)=>({path:"family-A/drafts/"+i,url:"https://fixture.invalid/"+i})),
    "not-an-array"
  ];
  for(const photos of cases){
    const {route,records}=api();
    const resp=await route.PUT(req("PUT",{payload:{title:"fixture"},photos}));
    assert.equal(resp.status,400);
    assert.equal(records.admin,0);
    assert.deepEqual(records.events,[]);
    assert.match(resp.headers.get("cache-control")??"",/private, no-store/);
  }
});
test("PUT still accepts omitted photos and valid own-photo references",async()=>{
  const inputs=[{payload:{title:"fixture"}},{payload:{title:"fixture"},photos:[
    {path:"family-A/drafts/photo1",url:"https://fixture.invalid/one"}
  ]}];
  for(const body of inputs){
    const {route,records}=api();
    const resp=await route.PUT(req("PUT",body));
    assert.equal(resp.status,200);
    assert.deepEqual(records.events,["db_upsert"]);
  }
});
