import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("lib/account-students/server.ts", "utf8");
const collectionRoute = readFileSync("app/api/account/students/route.ts", "utf8");
const itemRoute = readFileSync("app/api/account/students/[id]/route.ts", "utf8");
const accountPage = readFileSync("app/account/page.tsx", "utf8");
const authForm = readFileSync("components/auth/auth-form.tsx", "utf8");

test("student API requires authenticated confirmed users", () => {
  assert.match(collectionRoute, /auth\.getUser\(\)/);
  assert.match(itemRoute, /auth\.getUser\(\)/);
  assert.match(collectionRoute, /email_confirmed_at/);
  assert.match(itemRoute, /email_confirmed_at/);
  assert.match(collectionRoute, /"Debes iniciar sesión\.", 401, "unauthorized"/);
  assert.match(itemRoute, /"Debes iniciar sesión\.", 401, "unauthorized"/);
});

test("client cannot choose ownership or relationship", () => {
  assert.match(service, /parseStudentInput/);
  assert.match(service, /alias/);
  assert.match(service, /schoolId/);
  assert.match(service, /gradeLevel/);
  assert.doesNotMatch(service, /body\?\.owner_user_id/);
  assert.doesNotMatch(service, /body\?\.relationship/);
  assert.doesNotMatch(service, /body\?\.is_primary/);
  assert.doesNotMatch(service, /body\?\.academic_year/);
  assert.match(service, /relationshipForAccountType/);
  assert.match(service, /accountType === "student" \? "self" : "guardian"/);
});

test("all student mutations are owner scoped and server-side", () => {
  assert.match(service, /createAdminClient/);
  assert.match(service, /\.eq\("owner_user_id", userId\)/);
  assert.match(service, /owner_user_id: userId/);
  assert.match(service, /ensureActiveSchool/);
  assert.match(service, /\.eq\("is_active", true\)|school\.is_active/);
  assert.doesNotMatch(service, /from\("profiles"\)\.update/);
  assert.doesNotMatch(service, /from\("profiles"\)\.upsert/);
});

test("student accounts have one self context and parent accounts can have guardians", () => {
  assert.match(service, /student_context_exists/);
  assert.match(service, /accountType === "student" && existing\.length > 0/);
  assert.match(service, /relationshipForAccountType/);
  assert.match(service, /guardian/);
  assert.match(service, /relationship_mismatch/);
  assert.match(service, /student\.relationship !== relationship/);
  assert.match(service, /isPrimary = existing\.length === 0/);
});

test("deactivation preserves student self context and promotes next parent primary", () => {
  assert.match(service, /self_context_required/);
  assert.match(service, /Una cuenta de estudiante no puede eliminar su propio contexto educativo/);
  assert.match(service, /existing\.is_primary/);
  assert.match(service, /is_primary: true/);
  assert.match(service, /active: false/);
});

test("account reads students while mutations remain behind the server API", () => {
  const section = readFileSync("components/account/account-students-section.tsx", "utf8");

  assert.match(accountPage, /from\("account_students"\)/);
  assert.match(accountPage, /\.eq\("owner_user_id", user\.id\)/);
  assert.match(accountPage, /\.eq\("active", true\)/);
  assert.match(accountPage, /AccountStudentsSection/);
  assert.match(section, /\/api\/account\/students/);
  assert.match(section, /method: editingId \? "PATCH" : "POST"/);
  assert.match(section, /method: "DELETE"/);
  assert.doesNotMatch(section, /from\("profiles"\)/);
  assert.doesNotMatch(section, /createClient\(\)/);
  assert.doesNotMatch(section, /localStorage/);
  assert.doesNotMatch(section, /window\.confirm/);
});

test("signup continues to capture account-holder name surname and postal code", () => {
  assert.match(authForm, /const \[firstName, setFirstName\]/);
  assert.match(authForm, /const \[lastName, setLastName\]/);
  assert.match(authForm, /const \[postalCode, setPostalCode\]/);
  assert.match(authForm, /El nombre es obligatorio/);
  assert.match(authForm, /Los apellidos son obligatorios/);
  assert.match(authForm, /código postal español válido/);
  assert.match(authForm, /first_name: normalizedFirstName/);
  assert.match(authForm, /last_name: normalizedLastName/);
  assert.match(authForm, /postal_code: normalizedPostalCode/);
});


test("educational center is optional while course remains required", () => {
  assert.match(service, /schoolId: string \| null/);
  assert.match(service, /if \(schoolId && !UUID_RE\.test\(schoolId\)\)/);
  assert.match(service, /if \(!gradeLevel\)/);
  assert.match(service, /if \(input\.schoolId\) \{[\s\S]*ensureActiveSchool\(input\.schoolId\)/);
});

test("student self context never stores an alias supplied by the client", () => {
  assert.match(service, /alias: accountType === "student" \? null : input\.alias/);
});
