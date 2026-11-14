import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {mkdtemp,mkdir,writeFile,rm,readFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {readFileSync} from "node:fs";
import {reconcileStorageInventory} from "../../scripts/pilot-dr-storage-aggregate-reconcile.mjs";
function sha256(b){return createHash("sha256").update(b).digest("hex");}
async function fixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),"wetudy-agg-dr-"));
 const rows=[["listing-photos","one.webp",Buffer.from("abc")],
             ["chat-attachments","two.txt",Buffer.from("note")]];
 const files=[];
 for(const [bucket,file,bytes] of rows){
  await mkdir(path.join(root,bucket),{recursive:true});
  await writeFile(path.join(root,bucket,file),bytes);
  files.push({bucket,path:file,size:bytes.length,sha256:sha256(bytes)});
 }
 await writeFile(path.join(root,"manifest.json"),JSON.stringify({
  version:1,buckets:["listing-photos","chat-attachments"],fileCount:2,totalBytes:7,files
 }));
 const inventory={buckets:{
  "listing-photos":{objects:1,bytes:3,invalidSize:0,bucketExists:true},
  "chat-attachments":{objects:1,bytes:4,invalidSize:0,bucketExists:true},
 }};
 return {root,inventory};
}
test("real local bytes+SHA256 must match independent bucket aggregates",async()=>{
 const {root,inventory}=await fixture();
 try{
  assert.deepEqual(await reconcileStorageInventory(root,inventory),
   {objects:2,bytes:7,buckets:2});
 } finally {await rm(root,{recursive:true,force:true});}
});
test("reject missing bucket, invalid size, stale inventory and corrupted bytes",async()=>{
 const {root,inventory}=await fixture();
 try{
  const bad=structuredClone(inventory);
  bad.buckets["listing-photos"].objects=2;
  await assert.rejects(reconcileStorageInventory(root,bad),/NO_GO_STORAGE_AGGREGATE_MISMATCH/);
  const wrong=structuredClone(inventory);
  wrong.buckets["chat-attachments"].bytes=0;
  await assert.rejects(reconcileStorageInventory(root,wrong),/NO_GO_STORAGE_AGGREGATE_MISMATCH/);
  const missing=structuredClone(inventory);
  missing.buckets["listing-photos"].bucketExists=false;
  await assert.rejects(reconcileStorageInventory(root,missing),/NO_GO_STORAGE_AGGREGATE_MISMATCH/);
  const invalid=structuredClone(inventory);
  invalid.buckets["chat-attachments"].invalidSize=1;
  await assert.rejects(reconcileStorageInventory(root,invalid),/NO_GO_STORAGE_AGGREGATE_MISMATCH/);
  await writeFile(path.join(root,"chat-attachments","two.txt"),"bad!");
  await assert.rejects(reconcileStorageInventory(root,inventory),/verification failed/);
 } finally {await rm(root,{recursive:true,force:true});}
});
test("production inventory SQL is metadata-only and audited by readonly SQL guard",()=>{
 const sql=readFileSync("scripts/pilot-dr-storage-aggregate-readonly.sql","utf8");
 const guard=readFileSync("scripts/pilot-readonly-sql-guard.py","utf8");
 assert.match(sql,/BEGIN TRANSACTION READ ONLY;/);
 assert.match(sql,/ROLLBACK;/);
 assert.match(sql,/storage\.objects/);
 assert.match(sql,/storage\.buckets/);
 assert.match(sql,/jsonb_object_agg/);
 assert.match(guard,/pilot-dr-storage-aggregate-readonly\.sql/);
 assert.doesNotMatch(sql,/\b(?:INSERT INTO|UPDATE storage|DELETE FROM|ALTER TABLE|DROP TABLE)\b/i);
});
