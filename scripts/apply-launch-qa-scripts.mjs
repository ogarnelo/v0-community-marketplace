#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const packageJsonPath = path.join(process.cwd(), "package.json");

if (!fs.existsSync(packageJsonPath)) {
  console.error("❌ package.json not found. Run this script from the project root.");
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

packageJson.scripts = {
  ...(packageJson.scripts || {}),
  "check:env": "node scripts/check-env.mjs",
  "test:contracts": "node --test \"__tests__/**/*.test.mjs\"",
  "test:smoke": "node scripts/launch-smoke.mjs",
  "launch:qa": "npm run check:env && npm run test:contracts && npm run build",
};

fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log("✅ Launch QA scripts merged into package.json");
console.log("Added/updated:");
console.log("- check:env");
console.log("- test:contracts");
console.log("- test:smoke");
console.log("- launch:qa");
