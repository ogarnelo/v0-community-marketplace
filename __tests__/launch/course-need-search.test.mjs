import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20261001211446_course_needs_demand_link.sql",
  "utf8"
);
const helper = readFileSync(
  "lib/my-course/course-need-search-server.ts",
  "utf8"
);
const route = readFileSync(
  "app/api/my-course/needs/[id]/search/route.ts",
  "utf8"
);
const itemRoute = readFileSync(
  "app/api/my-course/needs/[id]/route.ts",
  "utf8"
);
const page = readFileSync("app/mi-curso/page.tsx", "utf8");
const client = readFileSync(
  "components/my-course/my-course-client.tsx",
  "utf8"
);

test("course_needs gains only an explicit demand link", () => {
  assert.match(migration, /alter table public\.course_needs/);
  assert.match(
    migration,
    /demand_request_id uuid[\s\S]*references public\.demand_requests\(id\)[\s\S]*on delete set null/
  );
  assert.match(migration, /course_needs_demand_request_id_uidx/);
  assert.doesNotMatch(migration, /alter table public\.saved_searches/);
  assert.doesNotMatch(migration, /alter table public\.demand_requests/);
  assert.doesNotMatch(migration, /student_id[\s\S]*saved_searches|student_id[\s\S]*demand_requests/);
});

test("Buscar por mí derives student context server-side", () => {
  assert.match(helper, /\.eq\("owner_user_id", userId\)/);
  assert.match(helper, /\.from\("account_students"\)/);
  assert.match(helper, /student\.academic_year !== need\.academic_year/);
  assert.match(helper, /school_id: need\.student\.school_id/);
  assert.match(helper, /grade_level: need\.student\.grade_level/);
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /email_confirmed_at/);
  assert.match(route, /activateCourseNeedSearch\(user\.id, id\)/);
});

test("activation reuses demand_requests as stable identity and saved_searches for alerts", () => {
  assert.match(helper, /\.from\("demand_requests"\)/);
  assert.match(helper, /source: "course_need"/);
  assert.match(helper, /course_need_id: need\.id/);
  assert.match(helper, /student_id: need\.student_id/);
  assert.match(helper, /academic_year: need\.academic_year/);

  assert.match(helper, /\.from\("saved_searches"\)/);
  assert.match(helper, /demand_request_id: demandRequestId/);
  assert.match(helper, /intent_source: "course_need"/);
  assert.match(helper, /source_path: "\/mi-curso"/);
  assert.match(helper, /notifications_enabled: true/);
});

test("alerts stay general while demand keeps educational context", () => {
  assert.match(helper, /query: need\.isbn \? null : need\.title/);
  assert.match(helper, /isbn_query: need\.isbn/);
  assert.match(helper, /category: null/);
  assert.match(helper, /grade_level: null/);
  assert.match(helper, /only_my_community: false/);
});

test("activation is idempotent and archives stop future alerts", () => {
  assert.match(helper, /findExistingDemand/);
  assert.match(helper, /\.contains\("metadata", \{ course_need_id: needId \}\)/);
  assert.match(helper, /\.is\("demand_request_id", null\)/);
  assert.match(helper, /archiveCourseNeedAndStopSearch/);
  assert.match(helper, /notifications_enabled: false/);
  assert.match(helper, /status: "dismissed"/);
  assert.match(itemRoute, /archiveCourseNeedAndStopSearch\(user\.id, id\)/);
});

test("Mi curso exposes Buscar por mí only from the pending card", () => {
  assert.match(page, /demandRequestId: need\.demand_request_id/);
  assert.match(client, /demandRequestId/);
  assert.match(client, /\/api\/my-course\/needs\/".*\/search/);
  assert.match(client, /Buscar por mí/);
  assert.match(client, /Buscando por ti/);
});
