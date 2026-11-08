import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync("scripts/pilot-qr-guest-browser-smoke.cjs", "utf8");
const workflow = readFileSync(".github/workflows/pilot-qr-guest-browser-smoke.yml", "utf8");

test("guest QA browser checks are read only, use public centre fixture and require login", () => {
  assert.match(script, /https:\/\/www\.wetudy\.com/);
  assert.match(script, /20261007070000_school_test_visibility\.sql/);
  assert.match(script, /QA centre must remain hidden from generic public search/);
  assert.match(script, /Unauthenticated QR administration must return 401/);
  assert.match(script, /guest QR -> login preserves selected school/);
  assert.match(script, /expectAdminPagesRequireLogin\(context\)/);
  assert.match(script, /"\/admin\/school"/);
  assert.match(script, /"\/admin\/super"/);
  assert.match(script, /"\/admin\/super\/reports\/00000000-0000-4000-8000-000000000000"/);
  assert.match(script, /maxRedirects: 0/);
  assert.match(script, /destination\.pathname, "\/auth"/);
  assert.match(script, /destination\.searchParams\.get\("next"\)/);
  assert.match(script, /Mobile QR screen should not overflow horizontally/);
  assert.match(script, /context\.request\.get/);
  assert.match(script, /context\.route\("\*\*\/api\/analytics\/\*\*"/);
  assert.doesNotMatch(script, /\.request\.post\(|\.request\.put\(|\.request\.patch\(|\.request\.delete\(|page\.fill\(|\.submit\(|\.signInWithPassword\(/);
});

test("workflow uses no production credentials, installs pinned Chromium only and runs on scoped changes", () => {
  assert.match(workflow, /playwright@1\.65\.0/);
  assert.match(workflow, /install --with-deps chromium/);
  assert.match(workflow, /timeout-minutes: 15/);
  assert.match(workflow, /permissions:\s*\n  contents: read/);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /paths:/);
  assert.doesNotMatch(workflow, /WETUDY_BACKUP_DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY|WETUDY_STORAGE_BACKUP_SERVICE_ROLE_KEY|BACKUP_ENCRYPTION_PASSWORD/);
});
