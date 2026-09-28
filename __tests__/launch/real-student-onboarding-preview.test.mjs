import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/beta/onboarding-estudiantes/page.tsx", "utf8");
const client = readFileSync("components/account-students/real-onboarding-preview.tsx", "utf8");
const accountPage = readFileSync("app/account/page.tsx", "utf8");
const authForm = readFileSync("components/auth/auth-form.tsx", "utf8");

test("real student onboarding remains Preview-only", () => {
  assert.match(page, /VERCEL_ENV !== "preview"/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /redirect\("\/api\/beta\/preview-login\?next=\/beta\/onboarding-estudiantes"\)/);
});

test("preview reads account-holder data but does not rewrite the signup or profile", () => {
  assert.match(page, /first_name, last_name, full_name, user_type, postal_code/);
  assert.match(client, /Datos del titular de la cuenta/);
  assert.match(client, /representante de la cuenta/);
  assert.doesNotMatch(client, /from\("profiles"\)/);
  assert.doesNotMatch(client, /supabase/);
  assert.doesNotMatch(accountPage, /onboarding-estudiantes/);
  assert.doesNotMatch(authForm, /onboarding-estudiantes/);
});

test("preview uses the real student API and not localStorage", () => {
  assert.match(client, /fetch\("\/api\/account\/students"/);
  assert.match(client, /method: editingId \? "PATCH" : "POST"/);
  assert.match(client, /method: "DELETE"/);
  assert.doesNotMatch(client, /localStorage/);
});

test("family flow can enter after one student or add another", () => {
  assert.match(client, /Ya puedes entrar en Wetudy/);
  assert.match(client, /Entrar en Wetudy/);
  assert.match(client, /Añadir otro estudiante/);
  assert.match(client, /Nombre o alias/);
  assert.match(client, /opcional/);
});

test("student flow never requires numbered children", () => {
  assert.match(client, /account\.accountType === "student"/);
  assert.match(client, /Mi curso/);
  assert.doesNotMatch(client, /Hijo|hijo|Hija|hija/);
});

test("partially filled second student cannot be silently lost", () => {
  assert.match(client, /draftHasAnyValue/);
  assert.match(client, /Completa centro y curso antes de continuar, o cancela este estudiante/);
  assert.match(client, /const saved = await saveDraft\(\)/);
});

test("mobile form fields avoid browser zoom", () => {
  assert.match(client, /text-base sm:text-sm/);
});


test("preview technical login creates a same-domain server session without magic links", () => {
  const previewLogin = readFileSync("app/api/beta/preview-login/route.ts", "utf8");

  assert.match(previewLogin, /VERCEL_ENV !== "preview"/);
  assert.match(previewLogin, /updateUserById/);
  assert.match(previewLogin, /signInWithPassword/);
  assert.match(previewLogin, /auth\.getUser\(\)/);
  assert.match(previewLogin, /preview_test_session/);
  assert.doesNotMatch(previewLogin, /generateLink/);
  assert.doesNotMatch(previewLogin, /magiclink/);
});
