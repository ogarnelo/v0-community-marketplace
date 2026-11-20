import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const auditPath = "scripts/pilot-anon-select-dependencies-readonly.sql";
const sql = readFileSync(auditPath, "utf8");
const runner = readFileSync("scripts/pilot-anon-select-wave1-pg17.py", "utf8");
const panel = readFileSync("components/agreements/agreement-panel.tsx", "utf8");
const conversation = readFileSync("app/messages/[id]/page.tsx", "utf8");
const workflow = readFileSync(".github/workflows/pilot-synthetic-db-storage-recovery.yml", "utf8");
const critical = readFileSync(".github/workflows/contracts.yml", "utf8");

test("dependency snapshot scans only Postgres catalogs in READ ONLY transaction", () => {
  assert.match(sql, /^BEGIN TRANSACTION READ ONLY;/m);
  assert.match(sql, /^COMMIT;/m);
  const body = sql.replace(/^\s*--.*$/gm, "");
  assert.doesNotMatch(body, /^\s*(?:REVOKE|GRANT|ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|TRUNCATE|DO|CALL|COPY)\b/gmi);
  assert.doesNotMatch(body, /\bFROM\s+(?:public|auth|storage)\.(?:agreements|demand_requests|profiles|saved_searches|schools|users|objects)\b/i);
  for (const t of ["agreements", "demand_requests", "profiles", "saved_searches", "schools"])
    assert.ok(sql.includes("'" + t + "'"), "Missing relation " + t);
  for (const catalog of ["pg_class", "pg_namespace", "pg_policies",
                          "pg_publication_tables", "pg_depend", "pg_rewrite", "pg_proc"])
    assert.ok(sql.includes(catalog), "Missing catalog " + catalog);
  assert.match(sql, /has_table_privilege\('anon'/);
  assert.match(sql, /has_table_privilege\('authenticated'/);
  assert.match(sql, /has_function_privilege\('anon'/);
  assert.match(sql, /prosecdef/);
  assert.match(sql, /security_invoker=true/);
  assert.match(sql, /HEURISTIC/);
});

test("authenticated agreement subscription is attached only after page requires a user", () => {
  assert.match(panel, /\.channel\(\`agreement-panel:\$\{conversationId\}\`\)/);
  assert.match(panel, /"postgres_changes"/);
  assert.match(panel, /table:\s*"agreements"/);
  assert.match(panel, /filter:\s*\`conversation_id=eq\.\$\{conversationId\}\`/);
  assert.match(panel, /\.subscribe\(\)/);
  assert.match(panel, /removeChannel\(channel\)/);
  const authGuard = conversation.indexOf("if (!user) redirect(");
  const firstRender = conversation.indexOf("<AgreementPanel");
  assert.ok(authGuard >= 0 && firstRender > authGuard,
    "Agreement realtime panel must not be rendered for unauthenticated visitors");
  assert.match(conversation, /\.or\(\`buyer_id\.eq\.\$\{user\.id\},seller_id\.eq\.\$\{user\.id\}\`\)/);
  assert.match(conversation, /currentUserId=\{user\.id\}/);
});

test("local PG17 fixture preserves agreement publication membership and authenticated SELECT", () => {
  assert.match(runner, /create publication wetudy_test_agreements_pub/);
  assert.match(runner, /pg_publication_tables/);
  assert.match(runner, /check_realtime_publication\(\)/);
  assert.match(runner, /privilege\("authenticated", "agreements", "SELECT"\)/);
  assert.match(runner, /Agreement Realtime publication membership changed/);
  assert.match(runner, /relreplident/);
  assert.match(runner, /Refusing nonlocal\/non-disposable PostgreSQL/);
  assert.match(workflow, /scripts\/pilot-anon-select-dependencies-readonly\.sql/);
  assert.match(critical, /pilot-anon-select-dependencies-review-only\.test\.mjs/);
});

test("snapshot is only metadata, not proof of live Realtime delivery or external consumers", () => {
  assert.match(sql, /Membership is not evidence of actual clients/);
  assert.match(sql, /dynamic SQL/i);
  assert.doesNotMatch(sql, /select\s+\*\s+from\s+public\./i);
});
