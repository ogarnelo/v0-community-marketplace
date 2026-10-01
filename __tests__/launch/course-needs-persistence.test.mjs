import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20261001204816_course_needs_foundation.sql",
  "utf8"
);
const fkIndexMigration = readFileSync(
  "supabase/migrations/20261001204851_course_needs_student_fk_index.sql",
  "utf8"
);
const service = readFileSync(
  "lib/my-course/course-needs-server.ts",
  "utf8"
);
const collectionRoute = readFileSync(
  "app/api/my-course/needs/route.ts",
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

test("course_needs migration is additive and isolated", () => {
  assert.match(migration, /create table if not exists public\.course_needs/);
  assert.match(migration, /owner_user_id uuid not null references public\.profiles\(id\) on delete cascade/);
  assert.match(migration, /student_id uuid not null references public\.account_students\(id\) on delete cascade/);
  assert.match(migration, /academic_year text not null/);
  assert.match(migration, /status in \('active', 'fulfilled', 'archived'\)/);

  assert.doesNotMatch(migration, /alter table public\.profiles/);
  assert.doesNotMatch(migration, /alter table public\.account_students/);
  assert.doesNotMatch(migration, /alter table public\.saved_searches/);
  assert.doesNotMatch(migration, /alter table public\.demand_requests/);
  assert.doesNotMatch(migration, /insert into public\.(profiles|account_students|saved_searches|demand_requests)/);
  assert.doesNotMatch(migration, /update public\./);
});

test("course_needs foreign keys have supporting indexes", () => {
  assert.match(migration, /course_needs_owner_student_active_idx/);
  assert.match(fkIndexMigration, /course_needs_student_id_idx/);
  assert.match(fkIndexMigration, /on public\.course_needs \(student_id\)/);
});

test("course_needs is read-only from authenticated clients", () => {
  assert.match(migration, /alter table public\.course_needs enable row level security/);
  assert.match(migration, /revoke all on table public\.course_needs from anon, authenticated/);
  assert.match(migration, /grant select on table public\.course_needs to authenticated/);
  assert.match(migration, /course_needs_select_own/);
  assert.match(migration, /auth\.uid\(\).*owner_user_id/);
  assert.doesNotMatch(migration, /for insert/);
  assert.doesNotMatch(migration, /for update/);
  assert.doesNotMatch(migration, /for delete/);
});

test("server derives ownership and academic year from the authenticated user's student", () => {
  assert.match(service, /\.eq\("owner_user_id", userId\)/);
  assert.match(service, /\.eq\("id", studentId\)/);
  assert.match(service, /!student\.active/);
  assert.match(service, /academic_year: student\.academic_year/);
  assert.match(service, /owner_user_id: userId/);
  assert.match(service, /student_id: input\.studentId/);
  assert.doesNotMatch(service, /ownerUserId.*body/);
  assert.doesNotMatch(service, /academicYear.*body/);
});

test("need API requires an authenticated confirmed account and uses server service", () => {
  assert.match(collectionRoute, /auth\.getUser\(\)/);
  assert.match(collectionRoute, /email_confirmed_at/);
  assert.match(collectionRoute, /parseCourseNeedInput/);
  assert.match(collectionRoute, /createCourseNeed\(user\.id, input\)/);
  assert.match(collectionRoute, /listCourseNeeds\(user\.id\)/);
  assert.match(itemRoute, /archiveCourseNeedAndStopSearch\(user\.id, id\)/);
});

test("duplicate protection is scoped by student and academic year", () => {
  assert.match(service, /\.eq\("student_id", input\.studentId\)/);
  assert.match(service, /\.eq\("academic_year", student\.academic_year\)/);
  assert.match(service, /need_exists/);
  assert.match(service, /normalizeIsbn/);
  assert.match(service, /normalizeText/);
});

test("deleting from Mi curso archives instead of destroying demand history", () => {
  assert.match(service, /status: "archived"/);
  assert.doesNotMatch(service, /\.delete\(\)/);
  assert.match(itemRoute, /export async function DELETE/);
});

test("Mi curso loads persisted needs server-side and mutates only through API", () => {
  assert.match(page, /listCourseNeeds\(user\.id\)/);
  assert.match(page, /initialNeeds=\{initialNeeds\}/);
  assert.match(client, /fetch\("\/api\/my-course\/needs"/);
  assert.match(client, /method: "POST"/);
  assert.match(client, /method: "DELETE"/);
  assert.doesNotMatch(client, /\.from\("course_needs"\)/);
  assert.doesNotMatch(client, /createAdminClient/);
});

test("legacy local needs are imported once through the same API", () => {
  assert.match(client, /localStorage\.getItem\(legacyStorageKey\)/);
  assert.match(client, /localStorage\.removeItem\(legacyStorageKey\)/);
  assert.match(client, /need_exists/);
  assert.doesNotMatch(client, /localStorage\.setItem/);
});

test("persistence phase still does not couple Mi curso to saved searches or demand requests", () => {
  for (const source of [migration, service, collectionRoute, itemRoute, page, client]) {
    assert.doesNotMatch(source, /saved_searches/);
    assert.doesNotMatch(source, /demand_requests/);
  }
});
