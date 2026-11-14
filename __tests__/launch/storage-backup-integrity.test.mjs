import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  BUCKETS, exportBuckets, safeStorageName, verifyStorageDirectory,
} from "../../scripts/pilot-storage-backup.mjs";

test("backup paths reject traversal and path separators", () => {
  for (const unsafe of ["", ".", "..", "../foo", "foo/bar", "foo\\bar", "foo\0bar"]) {
    assert.equal(safeStorageName(unsafe), false);
  }
  assert.deepEqual(BUCKETS, ["listing-photos", "chat-attachments"]);
});

test("export and verify both buckets, then reject tampered backup data", async () => {
  const fixture = {
    "listing-photos": {
      "": [{ name: "family", id: null }],
      "family": [{ name: "photo.webp", id: "photo-1", metadata: { size: 3 } }],
    },
    "chat-attachments": {
      "": [{ name: "private.txt", id: "chat-1", metadata: { size: 5 } }],
    },
  };
  const bytes = {
    "listing-photos/family/photo.webp": Buffer.from("img"),
    "chat-attachments/private.txt": Buffer.from("hello"),
  };
  const client = {
    storage: {
      from: (bucket) => ({
        list: async (prefix) => ({ data: fixture[bucket][prefix] || [], error: null }),
        download: async (name) => ({
          data: new Blob([bytes[bucket + "/" + name]]), error: null,
        }),
      }),
    },
  };
  const dir = await mkdtemp(path.join(os.tmpdir(), "wetudy-storage-sandbox-"));
  try {
    const exported = await exportBuckets(client, dir);
    assert.deepEqual(exported, { files: 2, bytes: 8 });
    const validated = await verifyStorageDirectory(dir);
    assert.deepEqual(validated, { objects: 2, bytes: 8 });
    const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
    assert.equal(manifest.files.length, 2);
    assert.ok(manifest.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256)));
    await writeFile(path.join(dir, "chat-attachments", "private.txt"), "tampered");
    await assert.rejects(verifyStorageDirectory(dir), /verification failed/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("encrypted Storage backup remains a manually triggered workflow with no plaintext artifacts", () => {
  const w = new URL("../../.github/workflows/wetudy-encrypted-storage-backup.yml", import.meta.url);
  const content = requireText(w);
  assert.match(content, /workflow_dispatch/);
  assert.match(content, /WETUDY_STORAGE_BACKUP_SERVICE_ROLE_KEY/);
  assert.match(content, /openssl enc -aes-256-cbc -pbkdf2/);
  assert.match(content, /rm -rf backup\/storage-data/);
  assert.match(content, /backup\/wetudy-storage\.tar\.gz\.enc/);
  assert.doesNotMatch(content, /^\s+schedule:/m);
});

function requireText(url) {
  return readFileSync(url, "utf8");
}

test("Storage workflow does not require a non-existent npm lockfile", () => {
  const w = readFileSync(new URL("../../.github/workflows/wetudy-encrypted-storage-backup.yml", import.meta.url), "utf8");
  assert.doesNotMatch(w, /cache:\s*npm|npm\s+ci/);
  assert.match(w, /npm install --prefix scripts/);
  assert.match(w, /--no-save --package-lock=false --ignore-scripts --no-audit --no-fund/);
  assert.match(w, /@supabase\/supabase-js@2\.119\.0/);
  assert.match(w, /node scripts\/pilot-storage-backup\.mjs/);
});

test("Storage export rejects missing, malformed, zero-mismatch and negative sizes", async () => {
  const cases = [
    { size: undefined, expected: "missing size" },
    { size: "NaN", expected: "malformed size" },
    { size: -2, expected: "negative size" },
    { size: 0, expected: "zero metadata but nonempty download" },
    { size: 1.5, expected: "fractional size" },
  ];
  for (const { size, expected } of cases) {
    const client = {
      storage: {
        from: () => ({
          list: async () => ({ data: [{ name: "test.webp", id: "fixture", metadata: { size } }], error: null }),
          download: async () => ({ data: new Blob([Buffer.from("img")]), error: null }),
        }),
      },
    };
    const dir = await mkdtemp(path.join(os.tmpdir(), "wetudy-storage-size-negative-"));
    try {
      await assert.rejects(exportBuckets(client, dir), /metadata size mismatch/, expected);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

test("Storage export correctly accepts an actual zero-byte object", async () => {
  const dataByBucket = {
    "listing-photos": [{ name: "empty.webp", id: "photo", metadata: { size: 0 } }],
    "chat-attachments": [{ name: "note.txt", id: "note", metadata: { size: 4 } }],
  };
  const client = {
    storage: { from: (bucket) => ({
      list: async () => ({ data: dataByBucket[bucket], error: null }),
      download: async () => ({
        data: new Blob([bucket === "listing-photos" ? Buffer.alloc(0) : Buffer.from("note")]),
        error: null,
      }),
    }) },
  };
  const dir = await mkdtemp(path.join(os.tmpdir(), "wetudy-storage-zero-pass-"));
  try {
    assert.deepEqual(await exportBuckets(client, dir), { files: 2, bytes: 4 });
    assert.deepEqual(await verifyStorageDirectory(dir), { objects: 2, bytes: 4 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("restored backup refuses symbolic links even if the target hash matches", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "wetudy-storage-symlink-"));
  const external = await mkdtemp(path.join(os.tmpdir(), "wetudy-storage-external-"));
  try {
    const raw = Buffer.from("private");
    const crypto = await import("node:crypto");
    const digest = crypto.createHash("sha256").update(raw).digest("hex");
    await (await import("node:fs/promises")).mkdir(path.join(dir,"chat-attachments"), {recursive:true});
    const externalFile=path.join(external,"private.txt");
    await writeFile(externalFile,raw);
    await symlink(externalFile,path.join(dir,"chat-attachments","private.txt"));
    const manifest={version:1,buckets:BUCKETS,fileCount:1,totalBytes:raw.length,
      files:[{bucket:"chat-attachments",path:"private.txt",size:raw.length,sha256:digest}]};
    await writeFile(path.join(dir,"manifest.json"),JSON.stringify(manifest));
    await assert.rejects(verifyStorageDirectory(dir),/Unsafe backup symlink/);
    await rm(path.join(dir,"chat-attachments","private.txt"));
    await writeFile(path.join(dir,"chat-attachments","private.txt"),raw);
    assert.deepEqual(await verifyStorageDirectory(dir),{objects:1,bytes:raw.length});

    await rm(path.join(dir,"manifest.json"));
    await writeFile(path.join(external,"manifest.json"),JSON.stringify(manifest));
    await symlink(path.join(external,"manifest.json"),path.join(dir,"manifest.json"));
    await assert.rejects(verifyStorageDirectory(dir),/Unsafe backup symlink/);
  } finally {
    await rm(dir,{recursive:true,force:true});
    await rm(external,{recursive:true,force:true});
  }
});

test("backup manifest fails closed on invalid per-object size and digest", async () => {
  const dir=await mkdtemp(path.join(os.tmpdir(),"wetudy-storage-manifest-negative-"));
  try {
    await (await import("node:fs/promises")).mkdir(path.join(dir,"listing-photos"),{recursive:true});
    await writeFile(path.join(dir,"listing-photos","a.webp"),"x");
    const base={version:1,fileCount:1,totalBytes:1,files:[
      {bucket:"listing-photos",path:"a.webp",size:1,sha256:"0".repeat(64)}]};
    for(const invalid of [null,-1,1.5,"1", Number.MAX_SAFE_INTEGER+1]){
      base.files[0].size=invalid;
      await writeFile(path.join(dir,"manifest.json"),JSON.stringify(base));
      await assert.rejects(verifyStorageDirectory(dir),/Invalid backup manifest entry/);
    }
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});
