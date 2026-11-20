import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const pyPath = "scripts/pilot-anon-realtime-live-pg17.py";
const jsPath = "scripts/pilot-anon-realtime-live-client.mjs";
const python = readFileSync(pyPath, "utf8");
const client = readFileSync(jsPath, "utf8");
const workflow = readFileSync(".github/workflows/pilot-synthetic-db-storage-recovery.yml", "utf8");
const critical = readFileSync(".github/workflows/contracts.yml", "utf8");

test("Realtime WebSocket test refuses real Supabase environments", () => {
  assert.match(python, /Refusing any remote Supabase credential in Realtime QA/);
  assert.match(python, /realtime-dev\.localhost/);
  assert.match(python, /127\.0\.0\.1/);
  assert.match(python, /wetudy_pilot_anon_select_wave1/);
  assert.match(python, /postgres:17/);
  assert.match(python, /supabase\/realtime:v2\./);
  assert.match(python, /wal_level=logical/);
  assert.match(python, /CREATE PUBLICATION supabase_realtime FOR TABLE public\.agreements/);
  assert.match(python, /No prod/);
  assert.match(python, /docker", "rm", "-f"/);
  assert.doesNotMatch(python, /https?:\/\/[^"\s]+supabase\.co|SUPABASE_URL|SERVICE_ROLE_KEY\s*=\s*['"]/i);
  const r = spawnSync("python3", ["-c",
    "import ast,pathlib;ast.parse(pathlib.Path('" + pyPath + "').read_text())"],
    {encoding:"utf8",timeout:5000});
  assert.equal(r.status,0,r.stderr);
});

test("real signed JWT + postgres_changes exercise participant and unauthorized actors twice", () => {
  assert.match(client, /new RealtimeClient\(/);
  assert.match(client, /transport:\s*globalThis\.WebSocket/);
  assert.match(client, /"postgres_changes"/);
  assert.match(client, /event:"UPDATE", schema:"public", table:"agreements"/);
  assert.match(client, /conversation_id=eq/);
  assert.match(client, /role:"buyer"/);
  assert.match(client, /role:"seller"/);
  assert.match(client, /role:"stranger"/);
  assert.match(client, /role:"guest"/);
  assert.match(client, /assert\.equal\(delivered, true/);
  assert.match(client, /must never receive private agreement records/);
  assert.match(client, /new\.status/);
  assert.match(python, /WS_TEST\), "before"/);
  assert.match(python, /pgfile\(PROPOSAL\)/);
  assert.match(python, /WS_TEST\), "after"/);
  assert.match(python, /has_table_privilege\('anon'/);
  assert.match(python, /has_table_privilege\('authenticated'/);
});

test("Realtime is mandatory in isolated CI and cannot be passed by static checks alone", () => {
  assert.match(workflow, /- "scripts\/pilot-anon-realtime-live-pg17\.py"/);
  assert.match(workflow, /- "scripts\/pilot-anon-realtime-live-client\.mjs"/);
  assert.match(workflow, /python3 scripts\/pilot-anon-realtime-live-pg17\.py/);
  assert.match(workflow, /node-version: 22/);
  assert.match(critical, /node --test __tests__\/launch\/pilot-anon-realtime-block-gate\.test\.mjs/);
  assert.match(python, /raise AssertionError\("Local Realtime tenant not ready/);
  assert.match(python, /raise AssertionError\("Anonymous SELECT survived/);
});
