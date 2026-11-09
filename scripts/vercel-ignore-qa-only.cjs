#!/usr/bin/env node
"use strict";
// Vercel Igored Build Step: exit 0 skips, exit 1 builds.
// Fail-open: missing Git parents, unexpected paths and errors always build.
const assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process");
function testOnly(path){
  return /^scripts\/pilot-[a-zA-Z0-9_.-]+\.(?:cjs|mjs|js|sql|sh|py)$/.test(path) ||
    /^scripts\/(?:verify-pilot-storage-restore|test_pilot_storage_restore)\.py$/.test(path) ||
    /^\.github\/workflows\/pilot-[a-zA-Z0-9_.-]+\.ya?ml$/.test(path);
}
function skip(paths){
  return Array.isArray(paths)&&paths.length>0&&
    paths.every(path=>typeof path==="string"&&testOnly(path));
}
function check(){
  const yes=[
    ["scripts/pilot-local-email-pkce-next-browser.cjs"],
    ["scripts/pilot-local-gotrue-snapshot-recovery.py"],
    ["scripts/pilot-synthetic-db-storage-recovery.py","scripts/verify-pilot-storage-restore.py","scripts/test_pilot_storage_restore.py"],
    ["scripts/pilot-local-email-pkce-fixture.sql",".github/workflows/pilot-email-pkce-local.yml"],
    [".github/workflows/pilot-three-ampa-real-next-browser.yml"]
  ];
  const no=[
    [],["app/onboarding/join-school/page.tsx"],["package.json"],["vercel.json"],
    ["supabase/migrations/20261108_security.sql"],
    ["scripts/vercel-ignore-qa-only.cjs"],["scripts/pilot-malicious.js/extra"],
    ["scripts/pilot-unsafe.py/extra"],["scripts/supabase-prod-migration.py"],
    ["scripts/verify-pilot-db-restore.py"],
    ["scripts/pilot-test.cjs","app/auth/callback/route.ts"],
    ["README.md","scripts/pilot-test.cjs"]
  ];
  for(const paths of yes)assert.equal(skip(paths),true,paths.join(","));
  for(const paths of no)assert.equal(skip(paths),false,paths.join(","));
  console.log("PASS Vercel QA-only guard: tests can skip; app, packages, migrations, config and mixed diffs must build.");
}
if(process.argv.includes("--self-test")){check();process.exit(0);}
try{
  // --no-renames exposes source deletions, so renaming application code
  // into a test path cannot accidentally suppress a real deployment.
  const diff=execFileSync("git",
    ["diff","--name-status","--no-renames","HEAD^","HEAD","--"],
    {encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:9000,maxBuffer:1048576}).trim();
  if(!diff)throw Error("empty diff");
  const files=diff.split("\n").map(line=>{
    const fields=line.split("\t");
    if(fields.length!==2||!/^[ACDM]$/.test(fields[0]))throw Error("unexpected git diff");
    return fields[1];
  });
  if(skip(files)){
    console.log("Skip Vercel build: "+files.length+" isolated pilot QA-only file(s).");
    process.exit(0);
  }
  console.log("Proceed with Vercel build: application, dependency, migration, config or other file changed.");
  process.exit(1);
}catch(_error){
  console.log("Proceed with Vercel build: test-only diff not conclusively established.");
  process.exit(1);
}
