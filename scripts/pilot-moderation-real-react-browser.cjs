#!/usr/bin/env node
"use strict";
// Browser exercise of the ACTUAL ReportStatusControls React component against
// a disposable in-memory API. It is NOT a database-backed or auth-integrated E2E.
// Guard: localhost-only HTTP server, no Supabase keys, no production requests.
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const ROOT = process.cwd();
const MODULES = process.env.PILOT_UI_MODULES || "/tmp/wetudy-pilot-moderation-ui/node_modules";
const { build } = require(path.join(MODULES, "esbuild"));
const { chromium } = require(path.join(MODULES, "playwright"));

async function bundledRealComponent() {
  const entry = [
    'import React from "react";',
    'import { createRoot } from "react-dom/client";',
    'import { ReportStatusControls } from "./components/admin/report-status-controls.tsx";',
    'createRoot(document.getElementById("app")).render(React.createElement(ReportStatusControls, {reportId: "11111111-1111-4111-8111-111111111111", initialStatus: "open"}));'
  ].join("\n");
  const result = await build({
    stdin: { contents: entry, resolveDir: ROOT, sourcefile: "pilot-ui-harness-entry.tsx", loader: "tsx" },
    bundle: true, write: false, format: "iife", platform: "browser",
    target: "es2020", nodePaths: [MODULES],
    plugins: [{
      name: "only-ui-primitive-stubs",
      setup(build) {
        build.onResolve({ filter: /^@\/components\/ui\/(?:button|textarea)$/ }, args =>
          ({ path: args.path, namespace: "ui-fixture" }));
        build.onLoad({ filter: /.*/, namespace: "ui-fixture" }, args => ({
          resolveDir: ROOT, loader: "tsx",
          contents: args.path.endsWith("/button")
            ? 'import React from "react"; export function Button({children,...props}) { return React.createElement("button",props,children); }'
            : 'import React from "react"; export function Textarea(props) { return React.createElement("textarea",props); }'
        }));
      }
    }]
  });
  return result.outputFiles[0].text;
}

function startServer(bundle) {
  const data = { status: "open", note: null, notices: 0, events: 0, requests: 0, rejectNext: false };
  const server = http.createServer(async (req, res) => {
    const send = (status, payload) => {
      res.writeHead(status, {"Content-Type":"application/json", "Cache-Control":"no-store"});
      res.end(JSON.stringify(payload));
    };
    if(req.method === "GET" && req.url === "/") {
      res.writeHead(200, {"Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store"});
      return res.end('<!doctype html><html lang="es"><meta charset="utf-8"><body><main id="app"></main><script>'+bundle+'</script></body></html>');
    }
    if(req.method !== "POST" || req.url !== "/api/admin/reports/status") return send(404,{error:"Not found"});
    if(!/qa-role=super_admin(?:;|$)/.test(req.headers.cookie || "")) return send(403,{error:"No autorizado."});
    if(data.rejectNext) {
      data.rejectNext = false;
      return send(503,{error:"Error ficticio de guardado"});
    }
    let raw = "";
    for await(const chunk of req) raw += chunk;
    let body;
    try { body=JSON.parse(raw); } catch { return send(400,{error:"JSON invalido"}); }
    if(body.reportId !== "11111111-1111-4111-8111-111111111111" ||
      !["open","reviewing","resolved","dismissed"].includes(body.status)) return send(400,{error:"Estado invalido"});
    data.requests += 1;
    const changed = data.status !== body.status;
    if(changed) {
      data.events++;
      if(["resolved","dismissed"].includes(body.status)) data.notices++;
    }
    data.status=body.status;
    data.note=["resolved","dismissed"].includes(body.status) ? body.resolutionNote || null : null;
    send(200,{ok:true,report:{id:body.reportId,status:data.status,resolution_note:data.note}});
  });
  return {server,data};
}

(async()=>{
  const bundle=await bundledRealComponent();
  const {server,data}=startServer(bundle);
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();
  const origin="http://127.0.0.1:"+address.port;
  const browser=await chromium.launch({headless:true});
  try {
    const context=await browser.newContext();
    await context.addCookies([{name:"qa-role",value:"super_admin",url:origin}]);
    const page=await context.newPage();
    // Reject network egress: only the disposable local origin is allowed.
    await page.route("**/*", route =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin,{waitUntil:"load"});
    await page.getByRole("button",{name:"Resuelta"}).click();
    await page.getByRole("button",{name:"Resuelta"}).waitFor();
    await page.waitForFunction(()=>document.querySelector('button') && 
      [...document.querySelectorAll("button")].find(b=>b.textContent==="Resuelta")?.disabled === true);
    assert.equal(data.status,"resolved");
    assert.equal(data.notices,1);
    assert.equal(data.events,1);

    await page.getByLabel("Respuesta al usuario").fill("Respuesta ficticia corregida");
    await page.getByRole("button",{name:"Guardar respuesta"}).click();
    await page.getByRole("button",{name:"Guardar respuesta"}).waitFor({state:"hidden"});
    assert.equal(data.note,"Respuesta ficticia corregida");
    assert.equal(data.notices,1,"Note edits must not duplicate a notice");
    assert.equal(data.events,1,"Note edits must not duplicate an event");

    await page.getByRole("button",{name:"En revisión"}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll("button")].find(b=>b.textContent==="En revisión")?.disabled===true);
    assert.equal(data.notices,1);
    assert.equal(data.events,2);
    await page.getByRole("button",{name:"Resuelta"}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll("button")].find(b=>b.textContent==="Resuelta")?.disabled===true);
    assert.equal(data.notices,2,"A new resolution transition creates one fresh notice");
    assert.equal(data.events,3);

    const asAMPA=await browser.newContext();
    await asAMPA.addCookies([{name:"qa-role",value:"school_admin",url:origin}]);
    const denied=await asAMPA.request.post(origin+"/api/admin/reports/status",{
      data:{reportId:"11111111-1111-4111-8111-111111111111",status:"dismissed"}
    });
    assert.equal(denied.status(),403);
    assert.equal(data.notices,2);
    await asAMPA.close();

    data.rejectNext=true;
    await page.getByRole("button",{name:"Descartada"}).click();
    await page.getByText("Error ficticio de guardado").waitFor();
    assert.equal(data.status,"resolved");
    assert.equal(data.notices,2);
    console.log("PASS: real React moderation controls in isolated Chromium, synthetic API:");
    console.log("  resolve -> edit note (no duplicate) -> reopen -> resolve -> AMPA rejected -> error visible");
    console.log("LIMIT: fake API only; no real auth, Postgres or complete page E2E.");
    await context.close();
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{ console.error("Isolated moderation UI failed",err);process.exitCode=1;});
