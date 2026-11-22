#!/usr/bin/env node
"use strict";
// WETUDY build cost guard. Vercel: exit 0 = SKIP, exit 1 = BUILD.
// Preserve the old pilot QA-only exclusions. Unknown paths, missing SHAs
// and unavailable Git history always BUILD; never skip code by accident.
const assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process");
function testOnly(path){
  return /^scripts\/pilot-[a-zA-Z0-9_.-]+\.(?:cjs|mjs|js|sql|sh|py)$/.test(path) ||
    /^scripts\/(?:verify-pilot-storage-restore|test_pilot_storage_restore)\.py$/.test(path) ||
    /^\.github\/workflows\/pilot-[a-zA-Z0-9_.-]+\.ya?ml$/.test(path);
}
function documentationOnly(path){
  return /^docs\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.mdx?$/.test(path) ||
    /^(?:README|AGENTS|CHANGELOG)\.md$/.test(path);
}
function skipUnreviewedPreview(env){
  // Preserve PR previews. Missing/unknown metadata must BUILD, not skip.
  return env.VERCEL_ENV === "preview" &&
    Object.prototype.hasOwnProperty.call(env,"VERCEL_GIT_PULL_REQUEST_ID") &&
    env.VERCEL_GIT_PULL_REQUEST_ID === "" &&
    /^[0-9a-f]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA || "");
}
function skip(paths){
  return Array.isArray(paths)&&paths.length>0&&
    paths.every(path=>typeof path==="string"&&(testOnly(path)||documentationOnly(path)));
}
function check(){
  const yes=[
    ["scripts/pilot-local-email-pkce-next-browser.cjs"],
    ["scripts/pilot-local-gotrue-snapshot-recovery.py"],
    ["scripts/pilot-synthetic-db-storage-recovery.py","scripts/verify-pilot-storage-restore.py","scripts/test_pilot_storage_restore.py"],
    ["scripts/pilot-local-email-pkce-fixture.sql",".github/workflows/pilot-email-pkce-local.yml"],
    [".github/workflows/pilot-three-ampa-real-next-browser.yml"],
    ["docs/pilot/WETUDY_START_HERE_CONTINUIDAD.md"],
    ["AGENTS.md","README.md"],
    ["docs/QA/guide.mdx","scripts/pilot-qa-test.cjs"]
  ];
  const no=[
    [],["app/onboarding/join-school/page.tsx"],["package.json"],["vercel.json"],
    ["supabase/migrations/20261108_security.sql"],
    ["scripts/vercel-ignore-qa-only.cjs"],["scripts/pilot-malicious.js/extra"],
    ["scripts/pilot-unsafe.py/extra"],["scripts/supabase-prod-migration.py"],
    ["scripts/verify-pilot-db-restore.py"],
    ["scripts/pilot-test.cjs","app/auth/callback/route.ts"],
    ["README.md","app/api/agreements/confirm/route.ts"],
    ["docs/pilot/active-migration.sql"],
    [".github/workflows/contracts.yml"]
  ];
  for(const paths of yes)assert.equal(skip(paths),true,paths.join(","));
  for(const paths of no)assert.equal(skip(paths),false,paths.join(","));
  const sha="a".repeat(40);
  assert.equal(skipUnreviewedPreview({VERCEL_ENV:"preview",VERCEL_GIT_PULL_REQUEST_ID:"",VERCEL_GIT_COMMIT_SHA:sha}),true);
  assert.equal(skipUnreviewedPreview({VERCEL_ENV:"preview",VERCEL_GIT_PULL_REQUEST_ID:"11",VERCEL_GIT_COMMIT_SHA:sha}),false);
  assert.equal(skipUnreviewedPreview({VERCEL_ENV:"production",VERCEL_GIT_PULL_REQUEST_ID:"",VERCEL_GIT_COMMIT_SHA:sha}),false);
  assert.equal(skipUnreviewedPreview({VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_SHA:sha}),false);
  assert.equal(skipUnreviewedPreview({VERCEL_ENV:"preview",VERCEL_GIT_PULL_REQUEST_ID:""}),false);
  console.log("PASS Vercel cost guard: no-PR previews, docs, pilot QA, and fail-open safety.");
}
if(process.argv.includes("--self-test")){check();process.exit(0);}
if(skipUnreviewedPreview(process.env)){
  console.log("Skip Vercel preview: branch has no open pull request.");
  process.exit(0);
}
try{
  // Compare against the last successful deployment, NOT HEAD^: otherwise
  // multiple commits including code + later docs could be hidden.
  const prev=process.env.VERCEL_GIT_PREVIOUS_SHA;
  const curr=process.env.VERCEL_GIT_COMMIT_SHA;
  if(!/^[0-9a-f]{40}$/.test(prev||"") ||
     !/^[0-9a-f]{40}$/.test(curr||"") || prev===curr){
    throw Error("cannot verify last successful deployment SHA");
  }
  execFileSync("git",["cat-file","-e",prev+"^{commit}"],
    {stdio:"ignore",timeout:8000});
  const diff=execFileSync("git",
    ["diff","--name-status","--no-renames",prev,curr,"--"],
    {encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:9000,maxBuffer:1048576}).trim();
  if(!diff)throw Error("empty diff");
  const files=diff.split("\n").map(line=>{
    const fields=line.split("\t");
    if(fields.length!==2 || !/^[ADM]$/.test(fields[0]))throw Error("unexpected git diff");
    return fields[1];
  });
  if(skip(files)){
    console.log("Skip Vercel build: "+files.length+" isolated pilot QA/docs file(s).");
    process.exit(0);
  }
  console.log("Proceed with Vercel build: code, config, migration or other change.");
  process.exit(1);
}catch(_error){
  console.log("Proceed with Vercel build: cannot prove an ignorable diff.");
  process.exit(1);
}
