import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  assert.match(w, /@supabase\/supabase-js@2\.49\.0/);
  assert.match(w, /node scripts\/pilot-storage-backup\.mjs/);
});
