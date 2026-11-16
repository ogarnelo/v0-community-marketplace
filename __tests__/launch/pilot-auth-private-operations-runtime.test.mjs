import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts = createRequire(import.meta.url)("typescript");
const UID = "11111111-1111-4111-8111-111111111111";
const MSG = "22222222-2222-4222-8222-222222222222";
const SCHOOL = "33333333-3333-4333-8333-333333333333";
const routes = [
  ["school access code", "app/api/schools/resolve-code/route.ts", "POST"],
  ["notification read", "app/api/notifications/read/route.ts", "POST"],
  ["notification read-all", "app/api/notifications/read-all/route.ts", "POST"],
  ["private attachment", "app/api/messages/attachment/route.ts", "GET"],
];

function build(path, method, opts = {}) {
  const ops = [];
  const {
    guest = false, missingSession = false, sessionNotFound = false,
    providerFailure = false, authThrows = false, clientThrows = false,
    dbFailure = false,
  } = opts;
  const query = {
    select: () => query,
    update: () => { ops.push("UPDATE"); return query; },
    eq: () => query,
    is: () => query,
    maybeSingle: async () => {
      if (dbFailure) return { data: null, error: { message: "PRIVATE_DATABASE_DIAGNOSTIC" } };
      if (ops.includes("QUERY:school_access_codes")) return { data: { school_id: SCHOOL }, error: null };
      if (ops.includes("QUERY:schools")) return { data: { id: SCHOOL, name: "Centro prueba", city: "Madrid", postal_code: "28001" }, error: null };
      return { data: { id: MSG, conversation_id: SCHOOL, attachment_path: "unused" }, error: null };
    },
    then: (resolve, reject) => Promise.resolve({
      error: dbFailure ? { message: "PRIVATE_DATABASE_DIAGNOSTIC" } : null,
    }).then(resolve, reject),
  };
  const fakeSupabase = {
    auth: {
      getUser: async () => {
        ops.push("AUTH");
        if (authThrows) throw new Error("PRIVATE_AUTH_EXCEPTION");
        return {
          data: { user: guest ? null : { id: UID } },
          error: missingSession ? { name: "AuthSessionMissingError" }
            : sessionNotFound ? { code: "session_not_found" }
            : providerFailure ? { name: "AuthProviderDown", message: "PRIVATE_AUTH_DIAGNOSTIC" } : null,
        };
      },
    },
    from: table => { ops.push("QUERY:" + table); return query; },
    storage: { from: () => ({ download: async () => ({ data: null, error: true }) }) },
  };
  const mocks = {
    "next/server": { NextResponse: { json: (body, options = {}) =>
      new Response(JSON.stringify(body), { status: options.status ?? 200, headers: options.headers ?? {} }) } },
    "@/lib/supabase/server": { createClient: async () => {
      ops.push("CLIENT");
      if (clientThrows) throw Error("PRIVATE_CREATE_FAILURE");
      return fakeSupabase;
    } },
    "@/lib/supabase/admin": { createAdminClient: () => {
      ops.push("ADMIN");
      return { from: table => { ops.push("QUERY:" + table); return query; } };
    } },
    "@/lib/messages/private-attachment-guards.mjs": {
      dispositionForAttachment: () => "attachment",
      safeAttachmentType: () => "application/octet-stream",
      validChatAttachmentPath: () => true,
    },
  };
  const src = readFileSync(path, "utf8");
  const compiled = ts.transpileModule(src, {
    fileName: path, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports, require: id => {
      if (!(id in mocks)) throw Error("Unexpected import: " + id);
      return mocks[id];
    },
    Date, Request, Response, Promise, URL,
  }, { filename: path, timeout: 2000 });
  async function request() {
    const url = "https://synthetic.invalid/api/example?messageId=" + MSG;
    const req = new Request(url, {
      method, ...(method === "POST" ? { headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "SCHOOL-TEST", notificationId: MSG }) } : {}),
    });
    const res = await exports[method](req);
    return {
      status: res.status,
      cache: res.headers.get("cache-control"),
      body: await res.json().catch(() => null),
    };
  }
  return { ops, request };
}

for (const [label, path, method] of routes) {
  for (const [scenario, opts, status] of [
    ["guest with no user", { guest: true }, 401],
    ["missing session with stale user", { missingSession: true }, 401],
    ["session_not_found with stale user", { sessionNotFound: true }, 401],
    ["provider error with stale user", { providerFailure: true }, 503],
    ["provider throws", { authThrows: true }, 503],
    ["client creation throws", { clientThrows: true }, 503],
  ]) {
    test(label + ": " + scenario + " fails closed", async () => {
      const h = build(path, method, opts);
      const r = await h.request();
      assert.equal(r.status, status);
      assert.match(r.cache || "", /private.*no-store/);
      assert.equal(h.ops.includes("ADMIN"), false);
      assert.equal(h.ops.some(x => x.startsWith("QUERY:")), false);
      assert.equal(h.ops.includes("UPDATE"), false);
      assert.doesNotMatch(JSON.stringify(r.body), /PRIVATE_|DIAGNOSTIC|EXCEPTION/);
    });
  }
}
for (const [label, path, method] of routes.slice(0, 3)) {
  test(label + ": authenticated operation succeeds with no-store", async () => {
    const h = build(path, method), r = await h.request();
    assert.equal(r.status, 200);
    assert.match(r.cache || "", /private.*no-store/);
    if (label === "school access code") assert.equal(h.ops.includes("ADMIN"), true);
    else assert.equal(h.ops.includes("UPDATE"), true);
  });
  test(label + ": SQL failure is private 503 without diagnostics", async () => {
    const h = build(path, method, { dbFailure: true }), r = await h.request();
    assert.equal(r.status, 503);
    assert.match(r.cache || "", /private.*no-store/);
    assert.doesNotMatch(JSON.stringify(r.body), /PRIVATE_|DIAGNOSTIC/);
  });
}

const helperCases = [
  ["getCurrentUser", "lib/auth/server-user.ts", "getCurrentUser"],
  ["getCurrentProfile", "lib/supabase/get-profile.ts", "getCurrentProfile"],
];
function loadAuthHelper(file, method, opt={}) {
  const operations=[];
  const user={id:UID,email:"private@example.invalid"};
  const client={
    auth:{getUser:async()=>{
      operations.push("AUTH");
      if(opt.throws)throw new Error("PRIVATE_AUTH_EXCEPTION");
      return {data:{user:opt.guest?null:user},error:
        opt.missing?{name:"AuthSessionMissingError"}:
        opt.missingCode?{code:"session_not_found"}:
        opt.provider?{message:"PRIVATE_PROVIDER_DIAGNOSTIC"}:null};
    }},
    from:table=>{
      operations.push("PROFILE_QUERY:"+table);
      const query={select:()=>query,eq:()=>query,
        single:async()=>({data:{id:UID,full_name:"Nombre sintético"},error:opt.profileError?{}:null})};
      return query;
    },
  };
  const mocks={
    "server-only":{},
    "react":{cache:fn=>fn},
    "@/lib/supabase/server":{createClient:async()=>{
      operations.push("CREATE_CLIENT");
      if(opt.clientThrows)throw new Error("PRIVATE_CREATE_ERROR");
      return client;
    }},
  };
  const src=readFileSync(file,"utf8"),compiled=ts.transpileModule(src,{
    fileName:file,reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  assert.equal(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
  const exp={};
  vm.runInNewContext(compiled.outputText,{
    exports:exp, require:id=>{
      if(!(id in mocks))throw Error("Unexpected import: "+id);
      return mocks[id];
    }, Promise,Error,
  },{timeout:1500,filename:file});
  return {operations,run:()=>exp[method]()};
}
for(const [label,file,method] of helperCases) {
  for(const [scenario,opt] of [
    ["sin usuario", {guest:true}],
    ["AuthSessionMissingError con usuario residual", {missing:true}],
    ["session_not_found con usuario residual", {missingCode:true}],
  ]) test(label+" — "+scenario+" no consulta perfil",async()=>{
    const h=loadAuthHelper(file,method,opt),v=await h.run();
    if(method==="getCurrentUser") assert.equal(v,null);
    else {assert.equal(v.user,null);assert.equal(v.profile,null);}
    assert.equal(h.operations.some(x=>x.startsWith("PROFILE_QUERY:")),false);
  });
  for(const [scenario,opt] of [
    ["fallo real del proveedor con usuario residual", {provider:true}],
    ["getUser lanza excepción", {throws:true}],
    ["createClient lanza excepción", {clientThrows:true}],
  ]) test(label+" — "+scenario+" falla cerrado sin revelar diagnóstico",async()=>{
    const h=loadAuthHelper(file,method,opt);
    await assert.rejects(h.run(),e=>{
      assert.match(e.message,/^auth_(user|profile)_unavailable$/);
      assert.doesNotMatch(e.message,/PRIVATE_/);
      return true;
    });
    assert.equal(h.operations.some(x=>x.startsWith("PROFILE_QUERY:")),false);
  });
  test(label+" — Auth confirmada conserva usuario y lectura autorizada",async()=>{
    const h=loadAuthHelper(file,method),v=await h.run();
    if(method==="getCurrentUser") assert.equal(v.id,UID);
    else {
      assert.equal(v.user.id,UID);
      assert.equal(v.profile.id,UID);
      assert.equal(h.operations.includes("PROFILE_QUERY:profiles"),true);
    }
  });
}
