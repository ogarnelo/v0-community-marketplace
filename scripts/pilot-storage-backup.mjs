/**
 * Read-only export of the two Wetudy Storage buckets.
 * Runner output is plaintext ONLY until the workflow encrypts it and removes it.
 * No service key, signed URLs, or private file names should be printed to logs.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const BUCKETS = Object.freeze(["listing-photos", "chat-attachments"]);
const MAX_OBJECTS = 10000;
const MAX_BYTES = 512 * 1024 * 1024;
const PAGE_SIZE = 100;

export function safeStorageName(name) {
  return typeof name === "string" &&
    name.length > 0 && name !== "." && name !== ".." &&
    !name.includes("/") && !name.includes("\\") && !name.includes("\0");
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function verifyStorageDirectory(baseDirectory) {
  const manifestPath = path.join(baseDirectory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.version !== 1 || !Array.isArray(manifest.files) ||
      manifest.files.length > MAX_OBJECTS) {
    throw new Error("Invalid backup manifest");
  }
  let bytes = 0;
  const seen = new Set();
  for (const item of manifest.files) {
    const segments = item.path?.split("/");
    if (!BUCKETS.includes(item.bucket) ||
        !Array.isArray(segments) ||
        segments.some((segment) => !safeStorageName(segment))) {
      throw new Error("Unsafe backup manifest path");
    }
    const key = item.bucket + "/" + item.path;
    if (seen.has(key)) throw new Error("Duplicate object in manifest");
    seen.add(key);
    const raw = await readFile(path.join(baseDirectory, item.bucket, ...segments));
    if (raw.length !== item.size || sha256(raw) !== item.sha256) {
      throw new Error("Storage backup verification failed");
    }
    bytes += raw.length;
  }
  if (bytes !== manifest.totalBytes || seen.size !== manifest.fileCount) {
    throw new Error("Storage backup totals do not match");
  }
  return { objects: seen.size, bytes };
}

export async function exportBuckets(client, baseDirectory) {
  const files = [];
  let totalBytes = 0;
  const seen = new Set();
  for (const bucket of BUCKETS) {
    async function visit(prefix = "") {
      let offset = 0;
      for (;;) {
        const { data, error } = await client.storage.from(bucket).list(prefix, {
          limit: PAGE_SIZE,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error) throw new Error("Could not enumerate Storage bucket " + bucket);
        if (!Array.isArray(data)) throw new Error("Invalid Storage listing");
        for (const item of data) {
          if (!safeStorageName(item.name)) throw new Error("Unsafe Storage object name");
          const objectPath = prefix ? prefix + "/" + item.name : item.name;
          if (item.id == null) {
            await visit(objectPath);
            continue;
          }
          const key = bucket + "/" + objectPath;
          if (seen.has(key)) throw new Error("Duplicate Storage object");
          if (files.length >= MAX_OBJECTS) throw new Error("Storage object limit reached");
          seen.add(key);
          const { data: body, error: downloadError } =
            await client.storage.from(bucket).download(objectPath);
          if (downloadError || !body) throw new Error("Could not download Storage object");
          const raw = Buffer.from(await body.arrayBuffer());
          totalBytes += raw.length;
          if (totalBytes > MAX_BYTES) throw new Error("Storage backup size limit reached");
          const claimedSize = Number(item.metadata?.size);
          if (Number.isFinite(claimedSize) && claimedSize > 0 && raw.length !== claimedSize) {
            throw new Error("Storage object metadata size mismatch");
          }
          const location = path.join(baseDirectory, bucket, ...objectPath.split("/"));
          await mkdir(path.dirname(location), { recursive: true, mode: 0o700 });
          await writeFile(location, raw, { mode: 0o600, flag: "wx" });
          files.push({ bucket, path: objectPath, size: raw.length, sha256: sha256(raw) });
        }
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    }
    await visit();
  }
  files.sort((a, b) => (a.bucket + "/" + a.path).localeCompare(b.bucket + "/" + b.path));
  const manifest = {
    version: 1,
    source: "Wetudy Storage API",
    createdAt: new Date().toISOString(),
    buckets: BUCKETS,
    fileCount: files.length,
    totalBytes,
    files,
  };
  await writeFile(path.join(baseDirectory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n",
    { mode: 0o600, flag: "wx" });
  return { files: files.length, bytes: totalBytes };
}

async function main() {
  const baseDirectory = process.env.WETUDY_STORAGE_BACKUP_DESTINATION || "backup/storage-data";
  if (process.argv.includes("--verify")) {
    const result = await verifyStorageDirectory(baseDirectory);
    console.log("Storage manifest and object digests verified:", result.objects, "objects");
    return;
  }
  const url = process.env.WETUDY_STORAGE_BACKUP_PROJECT_URL;
  const key = process.env.WETUDY_STORAGE_BACKUP_SERVICE_ROLE_KEY;
  if (!url || !/^https:\/\/[^/]+\.supabase\.co$/.test(url) || !key) {
    throw new Error("Missing or invalid Storage backup service configuration");
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const exported = await exportBuckets(client, baseDirectory);
  const verified = await verifyStorageDirectory(baseDirectory);
  if (exported.files !== verified.objects || exported.bytes !== verified.bytes) {
    throw new Error("Storage verification totals mismatch");
  }
  console.log("Verified encrypted-backup inputs:", verified.objects, "objects,", verified.bytes, "bytes");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
