#!/usr/bin/env node
"use strict";
// WETUDY Free plan: offline code-contract gate. NO network, secrets or production reads.
// This verifies backup workflows do not silently become scheduled/unencrypted.
// It is NOT proof an artifact exists, is current or is restorable.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const db=fs.readFileSync(".github/workflows/wetudy-encrypted-db-backup.yml","utf8");
const st=fs.readFileSync(".github/workflows/wetudy-encrypted-storage-backup.yml","utf8");
const exportCode=fs.readFileSync("scripts/pilot-storage-backup.mjs","utf8");
const scope=fs.readFileSync("scripts/pilot-dr-prod-inventory-readonly.sql","utf8");
function check(name,fn){try{fn();console.log("PASS "+name)}catch(e){console.error("BLOCK "+name+": "+e.message);process.exitCode=2}}
function manualOnly(source){
 assert.match(source,/on:\s*\n\s*workflow_dispatch:/);
 assert.doesNotMatch(source,/^\s*(?:schedule|push|pull_request):/m);
}
check("database backup is manual only, encrypted before upload",()=>{
 manualOnly(db);
 for(const s of ["pg_dump","--no-acl","wetudy-acl-snapshot.json.enc",
  "wetudy.dump.enc","openssl enc","-pbkdf2","-iter 200000",
  "SHA256SUMS.txt","pilot-verify-backup-sha256.py"])assert.ok(db.includes(s),s);
 assert.match(db,/rm -f backup\/wetudy\.dump/);
 assert.match(db,/retention-days:\s*7/);
});
check("Storage backups capture object bytes, not only rows, and upload encrypted only",()=>{
 manualOnly(st);
 for(const s of ["pilot-storage-backup.mjs","--verify","wetudy-storage.tar.gz.enc",
  "STORAGE_SHA256SUMS.txt","openssl enc","-pbkdf2",
  "tar -czf backup/wetudy-storage.tar.gz",
  "rm -rf backup/storage-data"])assert.ok(st.includes(s),s);
 assert.match(st,/retention-days:\s*7/);
 assert.match(st,/wetudy-storage\.tar\.gz\.enc/);
});
check("Storage exporter verifies SHA256 of actual downloaded bytes",()=>{
 for(const s of ["download(objectPath)","createHash(\"sha256\")",
  "verifyStorageDirectory","item.sha256","manifest.totalBytes",
  "manifest.fileCount","listing-photos","chat-attachments"])assert.ok(exportCode.includes(s),s);
});
check("inventory is read-only and cannot be confused with full recovery",()=>{
 assert.match(scope,/BEGIN TRANSACTION READ ONLY/);
 assert.ok(scope.trim().endsWith("ROLLBACK;"));
 assert.match(scope,/INVENTORY_ONLY__FULL_AUTH_STORAGE_RECOVERY_UNVERIFIED/);
 for(const s of ["auth.users","storage.buckets","storage.objects",
 "pg_database_size"])assert.ok(scope.includes(s),s);
});
console.log("Backup workflows verified as a code contract only. NO_GO remains until encrypted artifacts, actual restore, Auth and Storage bytes are checked.");
