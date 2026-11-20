#!/usr/bin/env node
/**
 * WETUDY #787 — source-only inventory of calls to five tables.
 * Does not use credentials, connect to Supabase, or read data.
 *
 * This inventory intentionally records *all* .from("table") calls, not only
 * SELECT: UPDATE and DELETE may require SELECT policies, and all new calls
 * deserve a privacy/compatibility review. It is NOT runtime proof.
 *
 * Usage:
 *    node scripts/pilot-anon-five-table-source-audit.mjs --inventory
 *    node scripts/pilot-anon-five-table-source-audit.mjs --check
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import assert from "node:assert/strict";

const roots = ["app", "components", "lib", "hooks", "contexts", "providers",
               "utils", "services", "src"];
const names = ["agreements", "demand_requests", "profiles", "saved_searches", "schools"];
const manifest = "docs/pilot/ANON_FIVE_TABLE_SOURCE_READER_BASELINE.json";
const codeSuffix = /\.(?:[cm]?js|jsx|tsx?)$/;
const fromLiteral = /\.\s*from\s*\(\s*(['"])(agreements|demand_requests|profiles|saved_searches|schools)\1\s*\)/g;
const restLiteral = /\/rest\/v1\/(agreements|demand_requests|profiles|saved_searches|schools)(?![a-z_])/g;
const fromAny = /\.\s*from\s*\(\s*([^)]{1,180})\)/g;

function filesIn(directory) {
  try {
    return readdirSync(directory, {withFileTypes:true})
      .flatMap(entry => {
        if (entry.name.startsWith(".") ||
            ["node_modules",".next","dist","build","coverage"].includes(entry.name))
          return [];
        const child = join(directory, entry.name);
        return entry.isDirectory() ? filesIn(child) :
          entry.isFile() && codeSuffix.test(entry.name) ? [child] : [];
      });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function buildInventory() {
  const results = [];
  const dynamic = [];
  for (const file of roots.flatMap(filesIn).sort()) {
    const content = readFileSync(file, "utf8");
    const path = relative(".",file).replaceAll("\\","/");
    const count = new Map();
    for (const pattern of [fromLiteral,restLiteral]) {
      pattern.lastIndex = 0;
      for (const match of content.matchAll(pattern)) {
        const table = pattern === fromLiteral ? match[2] : match[1];
        count.set(table, (count.get(table)??0)+1);
      }
    }
    for (const [table,calls] of [...count].sort((a,b)=>a[0].localeCompare(b[0]))) {
      results.push({path,table,calls});
    }
    fromAny.lastIndex=0;
    for (const match of content.matchAll(fromAny)) {
      const argument=match[1].trim();
      if (!/^(['"])[^'"]+\1$/.test(argument)) {
        // We cannot prove which table a dynamic .from(...) addresses.
        dynamic.push({path,argument:argument.slice(0,72)});
      }
    }
  }
  dynamic.sort((a,b)=>a.path.localeCompare(b.path)||a.argument.localeCompare(b.argument));
  return {schema_version:1, targets:names, readers:results, dynamic_from:dynamic};
}

const mode = process.argv[2];
if (!["--inventory","--check"].includes(mode) || process.argv.length!==3) {
  throw new Error("Use --inventory or --check (source-only, no network)");
}
const actual=buildInventory();
if(mode==="--inventory"){
  console.log("WETUDY_FIVE_TABLE_INVENTORY_START");
  console.log(JSON.stringify(actual,null,2));
  console.log("WETUDY_FIVE_TABLE_INVENTORY_END");
  console.log("Reader files:",new Set(actual.readers.map(x=>x.path)).size,
    "calls:",actual.readers.reduce((n,x)=>n+x.calls,0),
    "unclassified dynamic .from calls:",actual.dynamic_from.length);
} else {
  const expected=JSON.parse(readFileSync(manifest,"utf8"));
  try {assert.deepEqual(actual,expected)} catch (error) {
    const expectedKey=new Set(expected.readers.map(x=>x.path+"|"+x.table+"|"+x.calls));
    const currentKey=new Set(actual.readers.map(x=>x.path+"|"+x.table+"|"+x.calls));
    console.error("Reader census drift: new/changed",
      [...currentKey].filter(x=>!expectedKey.has(x)).join(" ; "));
    console.error("Reader census drift: removed/changed",
      [...expectedKey].filter(x=>!currentKey.has(x)).join(" ; "));
    console.error("Dynamic .from baseline also requires review when changed.");
    throw error;
  }
  console.log("PASS: five-table source reader census matched reviewed snapshot; ",
    actual.readers.length,"file/table pairs.");
}
