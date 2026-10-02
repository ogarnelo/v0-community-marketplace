import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const helper = readFileSync(
  "lib/my-course/course-need-search-server.ts",
  "utf8"
);
const route = readFileSync(
  "app/api/my-course/needs/[id]/search/route.ts",
  "utf8"
);
const page = readFileSync("app/mi-curso/page.tsx", "utf8");
const client = readFileSync(
  "components/my-course/my-course-client.tsx",
  "utf8"
);
const savedPage = readFileSync(
  "app/account/saved-searches/page.tsx",
  "utf8"
);
const savedList = readFileSync(
  "components/account/saved-searches-list.tsx",
  "utf8"
);

test("Mi curso derives Buscar por mí from the linked demand and real alert", () => {
  assert.match(helper, /getCourseNeedSearchStates/);
  assert.match(helper, /\.eq\("source", "course_need"\)/);
  assert.match(helper, /\.eq\("intent_source", "course_need"\)/);
  assert.match(helper, /notifications_enabled/);
  assert.match(helper, /demand\.status === "open" \|\| demand\.status === "matched"/);

  assert.match(page, /getCourseNeedSearchStates/);
  assert.match(page, /searchActive: need\.demand_request_id/);
  assert.match(client, /searchActive: boolean/);
  assert.match(client, /raw\.search_active === true/);
});

test("pause and reactivation reuse the same demand identity", () => {
  assert.match(helper, /pauseCourseNeedSearch/);
  assert.match(helper, /ensureDemandActive/);
  assert.match(helper, /\.update\(\{ status: "open" \}\)/);
  assert.match(helper, /\.eq\("status", "dismissed"\)/);
  assert.match(helper, /notifications_enabled: true/);
  assert.match(helper, /notifications_enabled: false/);

  assert.match(route, /export async function DELETE/);
  assert.match(route, /pauseCourseNeedSearch\(user\.id, id\)/);
  assert.match(route, /search_active: false/);
  assert.match(route, /search_active: true/);

  assert.match(client, /method: "DELETE"/);
  assert.match(client, /Pausar aviso/);
  assert.match(client, /Reactivar búsqueda/);
  assert.match(client, /Buscando por ti/);
});

test("course-need saved searches are managed from Mi curso instead of direct account mutations", () => {
  assert.match(savedPage, /intent_source/);
  assert.match(savedList, /item\.intent_source === "course_need"/);
  assert.match(savedList, /Gestionar en Mi curso/);
  assert.match(savedList, /href="\/mi-curso"/);
  assert.match(savedList, /\{!isCourseNeed \? \(/);
});
