import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const script = readFileSync("scripts/mvp-readiness.mjs", "utf8");
const workflow = readFileSync(".github/workflows/pilot-public-smoke.yml", "utf8");
test("manual-only public smoke does not run on PRs or cron", () => {
 assert.match(workflow, /workflow_dispatch:/);
 assert.doesNotMatch(workflow, /(?:^|\n)\s*(?:pull_request|push|schedule):/);
 assert.match(workflow, /node scripts\/mvp-readiness\.mjs/);
});
test("public smoke protects AMPA copy and legacy redirect without false positives on UGC", () => {
 assert.match(script, /pathname !== "\/marketplace" && forbiddenPublicCopy\.test\(html\)/);
 assert.match(script, /checkLegacyImpactRedirect/);
 assert.match(script, /\["\/ranking", "\/impacto"\]/);
 assert.match(script, /ampas-transformando-economia-escolar/);
 assert.match(script, /342 familias participaron/);
});
