#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const packageJsonPath = path.join(process.cwd(), "package.json");

if (!fs.existsSync(packageJsonPath)) {
  console.error("No encuentro package.json en esta carpeta.");
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
pkg.scripts ||= {};

pkg.scripts["test:contracts"] ||= "node scripts/test-contracts.mjs";
pkg.scripts["mvp:ready"] ||= "node scripts/mvp-readiness.mjs https://www.wetudy.com";
pkg.scripts["mvp:ready:local"] ||= "node scripts/mvp-readiness.mjs http://localhost:3000";

fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log("Scripts añadidos o conservados:");
console.log("- test:contracts");
console.log("- mvp:ready");
console.log("- mvp:ready:local");
