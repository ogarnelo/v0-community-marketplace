#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const packagePath = path.join(process.cwd(), "package.json");

if (!fs.existsSync(packagePath)) {
  console.error("package.json not found");
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
pkg.scripts ||= {};

const additions = {
  "check:env": "node scripts/check-env.mjs",
  "test:contracts": "node --test \"__tests__/**/*.test.mjs\"",
  "test:smoke": "node scripts/launch-smoke.mjs",
  "launch:qa": "npm run test:contracts && npm run check:env",
};

for (const [key, value] of Object.entries(additions)) {
  pkg.scripts[key] = value;
}

if (!pkg.scripts.test) {
  pkg.scripts.test = "npm run test:contracts";
}

fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log("✅ Launch QA scripts merged into package.json");
console.log("Added/updated:");
for (const key of Object.keys(additions)) console.log(`- ${key}`);
if (pkg.scripts.test === "npm run test:contracts") console.log("- test");
