#!/usr/bin/env node

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const candidates = [
  "__tests__/launch",
  "tests/launch",
  "__tests__",
  "tests",
].filter((dir) => existsSync(dir));

if (candidates.length === 0) {
  console.log("No hay carpeta de tests. Saltando test:contracts para este workspace.");
  process.exit(0);
}

const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".test.mjs") || entry.name.endsWith(".test.js")) files.push(full);
  }
}

for (const dir of candidates) walk(dir);

const contractFiles = files.filter((file) =>
  file.includes("launch") ||
  file.includes("contract") ||
  file.includes("mvp")
);

if (contractFiles.length === 0) {
  console.log("No hay tests contractuales encontrados. Saltando test:contracts.");
  process.exit(0);
}

const result = spawnSync(process.execPath, ["--test", ...contractFiles], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
