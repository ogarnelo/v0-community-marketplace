#!/usr/bin/env node
/**
 * WETUDY offline recovery reconciliation (Supabase Free).
 * Usage: node scripts/pilot-dr-storage-aggregate-reconcile.mjs --directory /path/to/recovered-storage --inventory /path/to/read-only-inventory.json
 * Input inventory is the single JSON object returned by pilot-dr-storage-aggregate-readonly.sql.
 * No remote calls, no service credentials, no private paths printed.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BUCKETS, verifyStorageDirectory } from "./pilot-storage-backup.mjs";

const MAX_INVENTORY_BYTES=32768;
export async function reconcileStorageInventory(baseDirectory, inventory) {
  if (!inventory || typeof inventory!=="object" || !inventory.buckets) {
    throw new Error("Invalid aggregate inventory");
  }
  const totals=await verifyStorageDirectory(baseDirectory);
  const manifest=JSON.parse(await readFile(path.join(baseDirectory,"manifest.json"),"utf8"));
  const byBucket=Object.fromEntries(BUCKETS.map(b=>[b,{objects:0,bytes:0}]));
  for (const item of manifest.files) {
    if (!Object.hasOwn(byBucket,item.bucket)) throw new Error("Unexpected bucket");
    byBucket[item.bucket].objects+=1;
    byBucket[item.bucket].bytes+=item.size;
  }
  for (const name of BUCKETS) {
    const expected=inventory.buckets[name],actual=byBucket[name];
    if (!expected || expected.bucketExists!==true ||
      !Number.isSafeInteger(expected.objects) ||
      !Number.isSafeInteger(expected.bytes) ||
      expected.objects<0 || expected.bytes<0 ||
      expected.invalidSize!==0 ||
      expected.objects!==actual.objects ||
      expected.bytes!==actual.bytes) {
      throw new Error("NO_GO_STORAGE_AGGREGATE_MISMATCH");
    }
  }
  const totalCount=Object.values(byBucket).reduce((n,b)=>n+b.objects,0);
  const totalBytes=Object.values(byBucket).reduce((n,b)=>n+b.bytes,0);
  if (totals.objects!==totalCount || totals.bytes!==totalBytes) {
    throw new Error("NO_GO_STORAGE_MANIFEST_TOTAL_MISMATCH");
  }
  return {objects:totalCount,bytes:totalBytes,buckets:BUCKETS.length};
}
async function main(argv) {
  const di=argv.indexOf("--directory"),ii=argv.indexOf("--inventory");
  if (di<0 || ii<0 || !argv[di+1] || !argv[ii+1]) {
    throw new Error("Provide --directory and --inventory (local files)");
  }
  const text=await readFile(argv[ii+1],"utf8");
  if (Buffer.byteLength(text)>MAX_INVENTORY_BYTES) throw new Error("Invalid inventory size");
  const result=await reconcileStorageInventory(argv[di+1],JSON.parse(text));
  console.log("PASS_STORAGE_AGGREGATE: "+result.objects+" objects, "+result.bytes+
    " bytes, "+result.buckets+" buckets; local bytes also passed SHA256.");
  console.log("NOT_VERIFIED: snapshot time matching, remote API restore, Auth or DB/ACL.");
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(e=>{
    // Never disclose object filenames or private local paths.
    console.error("NO_GO_STORAGE_AGGREGATE: "+e.constructor.name);
    process.exitCode=2;
  });
}
