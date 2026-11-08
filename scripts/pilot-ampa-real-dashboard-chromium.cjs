#!/usr/bin/env node
"use strict";
// The production SchoolAdminDashboard and original Radix/button primitives,
// bundled into Chromium with fictional school props. Auth and SSR are tested
// independently in the three-AMPA real Next/Supabase local suite.
const assert=require("node:assert/strict");
const fs=require("node:fs"),http=require("node:http"),path=require("node:path");
const ROOT=process.cwd(),MOD=process.env.PILOT_UI_MODULES||"/tmp/wetudy-moderation-integrated/node_modules";
const {build}=require(path.join(MOD,"esbuild"));
const {chromium}=require(path.join(MOD,"playwright"));
(async()=>{
 const result=await build({
  entryPoints:["scripts/pilot-ampa-dashboard-entry.cjs"],absWorkingDir:ROOT,
  bundle:true,write:false,format:"iife",platform:"browser",target:"es2020",
  nodePaths:[MOD],plugins:[{name:"project-alias",setup(b){
    b.onResolve({filter:/^@\//},arg=>{const base=path.join(ROOT,arg.path.slice(2));return {path:fs.existsSync(base+".tsx")?base+".tsx":base+".ts"};});
  }}]
 });
 const code=result.outputFiles[0].text;
 const server=http.createServer((req,res)=>{
  if(req.url?.startsWith("/api/")){res.writeHead(404);return res.end("QA only");}
  res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
  res.end('<!doctype html><html lang="es"><meta charset="utf-8"><body><div id="app"></div><script>'+code+'</script></body></html>');
 });
 await new Promise(done=>server.listen(0,"127.0.0.1",done));
 const origin="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  const ids={ALFA:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
   BETA:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
   GAMMA:"dddddddd-dddd-4ddd-8ddd-dddddddddddd"};
  for(const label of Object.keys(ids)){
   const ctx=await browser.newContext({acceptDownloads:true});
   await ctx.grantPermissions(["clipboard-read","clipboard-write"],{origin});
   const page=await ctx.newPage();
   await page.route("**/*",route=>new URL(route.request().url()).origin===origin
     ?route.continue():route.abort());
   await page.goto(origin+"/?school="+label,{waitUntil:"load"});
   await page.getByRole("tab",{name:"Impacto"}).waitFor();
   await page.getByText("Informe de impacto del centro").waitFor();
   await page.getByRole("tab",{name:"Actividad"}).click();
   await page.getByText("Visitas registradas").waitFor();
   await page.getByRole("tab",{name:"Comunidad"}).click();
   await page.getByText("Administradores del centro").waitFor();
   await page.getByText("ADMIN QA "+label).waitFor();
   await page.getByRole("tab",{name:"Código del centro"}).click();
   await page.getByText("QA-CODIGO-"+label,{exact:true}).waitFor();
   await page.getByRole("button",{name:"Copiar código"}).click();
   await page.getByRole("button",{name:"Copiado"}).waitFor();
   assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),"QA-CODIGO-"+label);
   await page.getByRole("button",{name:"Copiar enlace"}).click();
   await page.getByRole("button",{name:"Enlace copiado"}).waitFor();
   const url=await page.evaluate(()=>navigator.clipboard.readText());
   assert.ok(url.includes("school="+ids[label]));
   assert.ok(url.includes("utm_source=school")&&url.includes("utm_campaign=school_invite"));
   const text=await page.locator("body").innerText();
   for(const other of Object.keys(ids))if(other!==label)
     assert.ok(!text.includes("QA-CODIGO-"+other));
   await page.getByRole("tab",{name:"Impacto"}).click();
   const downloadPromise=page.waitForEvent("download");
   await page.getByRole("button",{name:"Descargar CSV de impacto"}).click();
   const csv=fs.readFileSync(await (await downloadPromise).path(),"utf8");
   assert.ok(csv.includes("COLEGIO QA "+label));
   assert.ok(csv.includes("Cuentas que seleccionaron el centro"));
   for(const other of Object.keys(ids))if(other!==label)
     assert.ok(!csv.includes("COLEGIO QA "+other));
   await page.route("**/api/school/report-subscription",route=>route.fulfill({
     status:503,contentType:"application/json",
     body:JSON.stringify({error:"Programación QA temporalmente indisponible"})
   }));
   await page.getByRole("button",{name:"Guardar programación"}).click();
   await page.getByRole("status").getByText("Programación QA temporalmente indisponible").waitFor();
   await ctx.close();
  }
  console.log("PASS real SchoolAdminDashboard, Radix Tabs, copy school code/link, scoped CSV and 503 error UI for 3 synthetic AMPA.");
  console.log("LIMIT: fictional props and fake 503; real Next SSR/Auth handled by separate previously verified test.");
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
})().catch(e=>{console.error("School dashboard React Chromium failed:",e.message);process.exitCode=1;});
