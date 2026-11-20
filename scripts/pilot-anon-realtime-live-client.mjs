#!/usr/bin/env node
// WETUDY #787: REAL Realtime WebSocket / postgres_changes, entirely local fake actors.
// The host, DB container, JWT secret and IDs are fixed test fixtures. No production API.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { RealtimeClient } from "@supabase/supabase-js";

const phase = process.argv[2];
if (!["before", "after"].includes(phase)) throw Error("Expected before/after phase");
const realtimeUrl = "http://realtime-dev.localhost:4107/socket";
const pgContainer = "wetudy-realtime-test-pg17";
const jwtSecret = "wetudy_realtime_synthetic_secret_local_only_2026_123456789";
const conversation = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const buyerId = "11111111-1111-4111-8111-111111111111";
const sellerId = "22222222-2222-4222-8222-222222222222";
const strangerId = "33333333-3333-4333-8333-333333333333";
const expectedStatus = phase === "before" ? "buyer_confirmed" : "seller_confirmed";

if (typeof globalThis.WebSocket !== "function") {
  throw Error("Node 22 native WebSocket is required");
}

function jwt(role, sub = "") {
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const prefix = enc({alg:"HS256", typ:"JWT"}) + "." +
    enc({role, iss:"wetudy-synthetic-only", sub, exp: Math.floor(Date.now()/1000)+600});
  const signature = createHmac("sha256", jwtSecret).update(prefix).digest("base64url");
  return prefix + "." + signature;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const scopes = [
  {role:"buyer", token:jwt("authenticated",buyerId), allow:true},
  {role:"seller", token:jwt("authenticated",sellerId), allow:true},
  {role:"stranger", token:jwt("authenticated",strangerId), allow:false},
  {role:"guest", token:jwt("anon"), allow:false},
];

const clients = [];
const errors = [];
async function openSubscription(identity) {
  const socket = new RealtimeClient(realtimeUrl, {
    params: {apikey:identity.token},
    transport: globalThis.WebSocket,
    vsn:"2.0.0",
    timeout:18000,
    heartbeatIntervalMs:5000,
  });
  clients.push(socket);
  const messages = [];
  const topic = "agreement-block-" + phase + "-" + identity.role;
  const channel = socket
    .channel(topic)
    .on("postgres_changes", {
      event:"UPDATE", schema:"public", table:"agreements",
      filter:"conversation_id=eq." + conversation,
    }, (payload) => messages.push(payload));

  let status = "unknown";
  const subscribed = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 20000);
    channel.subscribe((state, reason) => {
      status = state;
      if (state === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve(true);
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
        errors.push({role:identity.role,status:state,reason:String(reason ?? "")});
        clearTimeout(timer);
        resolve(false);
      }
    });
  });
  if (identity.allow) {
    assert.equal(subscribed, true,
      identity.role + " must establish authenticated postgres_changes subscription; " +
      JSON.stringify(errors));
  }
  return {role:identity.role,allow:identity.allow,messages,subscribed,status,channel};
}

async function waitFor(callback, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (callback()) return true;
    await sleep(250);
  }
  return callback();
}

let states = [];
try {
  states = await Promise.all(scopes.map(openSubscription));
  // A channel JOIN alone does not prove WAL replication has established.
  // Let the database CDC task subscribe and emit, then assert delivery.
  await sleep(3500);
  const query = "UPDATE public.agreements SET status='" + expectedStatus +
    "', updated_at=clock_timestamp() WHERE conversation_id='" + conversation +
    "' RETURNING status";
  const updated = execFileSync("docker", [
    "exec", pgContainer, "psql", "-X", "-q", "-A", "-t",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "wetudy_pilot_anon_select_wave1", "-c", query
  ], {encoding:"utf8",timeout:15000}).trim();
  assert.match(updated, new RegExp(expectedStatus), "Synthetic agreement UPDATE was not applied");

  const delivered = await waitFor(() =>
    states.filter(x=>x.allow).every(x =>
      x.messages.some(m => m?.new?.status === expectedStatus &&
        m?.new?.conversation_id === conversation)
    ), 16000);
  assert.equal(delivered, true,
    "Both signed agreement participants must get REAL Realtime WAL UPDATE. " +
    JSON.stringify({phase,diagnostic:states.map(s=>({
      role:s.role,joined:s.subscribed,events:s.messages.map(m=>({
        event:m.eventType, status:m?.new?.status,conversation:m?.new?.conversation_id
      }))
    })),errors}));
  await sleep(2800); // negative subscribers must stay silent.
  for (const state of states) {
    const leaked = state.messages.filter(m => m?.new?.conversation_id === conversation);
    if (state.allow) {
      assert.equal(leaked.filter(m=>m?.new?.status===expectedStatus).length,1,
        state.role+" must receive exactly one matching event");
    } else {
      assert.equal(leaked.length,0,
        state.role+" must never receive private agreement records");
    }
  }
  console.log("PASS: "+phase+
    " — real local Realtime UPDATE to buyer and seller only; " +
    "stranger and guest received zero agreement records.");
} finally {
  await Promise.allSettled(states.map(s=>s.channel.unsubscribe()));
  for (const client of clients) client.disconnect();
}
