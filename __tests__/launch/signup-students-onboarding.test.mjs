import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authForm = readFileSync("components/auth/auth-form.tsx", "utf8");
const callback = readFileSync("app/auth/callback/route.ts", "utf8");
const onboardingPage = readFileSync("app/onboarding/students/page.tsx", "utf8");
const onboardingClient = readFileSync(
  "components/onboarding/account-students-onboarding.tsx",
  "utf8"
);

test("signup captures account holder data only", () => {
  assert.match(authForm, /const \[firstName, setFirstName\]/);
  assert.match(authForm, /const \[lastName, setLastName\]/);
  assert.match(authForm, /const \[email, setEmail\]/);
  assert.match(authForm, /const \[password, setPassword\]/);
  assert.match(authForm, /const \[userType, setUserType\]/);
  assert.match(authForm, /const \[postalCode, setPostalCode\]/);

  assert.doesNotMatch(authForm, /const \[gradeLevel, setGradeLevel\]/);
  assert.doesNotMatch(authForm, /Curso \/ Etapa/);
  assert.doesNotMatch(authForm, /Debes seleccionar un curso o etapa/);
  assert.doesNotMatch(authForm, /grade_level: gradeLevel/);
});

test("new signup confirmation lands on student onboarding", () => {
  assert.match(authForm, /"\/onboarding\/students"/);
  assert.match(
    authForm,
    /\/onboarding\/students\?next=\$\{encodeURIComponent\(nextPath\)\}/
  );
  assert.match(callback, /"\/onboarding\/students"/);
});

test("student onboarding reads real account students and active schools", () => {
  assert.match(onboardingPage, /from\("account_students"\)/);
  assert.match(onboardingPage, /\.eq\("owner_user_id", user\.id\)/);
  assert.match(onboardingPage, /\.eq\("active", true\)/);
  assert.match(onboardingPage, /from\("schools"\)/);
  assert.match(onboardingPage, /\.eq\("is_active", true\)/);
  assert.match(onboardingPage, /getSafeInternalPath/);
});

test("student onboarding persists through the secure student API", () => {
  assert.match(onboardingClient, /\/api\/account\/students/);
  assert.match(onboardingClient, /method: editingId \? "PATCH" : "POST"/);
  assert.match(onboardingClient, /method: "DELETE"/);
  assert.doesNotMatch(onboardingClient, /localStorage/);
  assert.doesNotMatch(onboardingClient, /from\("profiles"\)/);
});

test("family can enter after first student or add another", () => {
  assert.match(onboardingClient, /Entrar en Wetudy/);
  assert.match(onboardingClient, /Añadir otro estudiante/);
  assert.match(onboardingClient, /Nombre o alias/);
  assert.match(onboardingClient, /opcional/);
  assert.match(onboardingClient, /Estudiante 1/);
});

test("student account stays a single self context in UX", () => {
  assert.match(onboardingClient, /accountType === "student"/);
  assert.match(onboardingClient, /Mi curso/);
  assert.doesNotMatch(onboardingClient, /Hijo|hijo|Hija|hija/);
});

test("account holder identity remains separate from student alias", () => {
  assert.match(onboardingClient, /Cuenta de \{accountHolderName\}/);
  assert.match(onboardingClient, /Nombre o alias/);
  assert.doesNotMatch(onboardingClient, /birth_date|date_of_birth|fechaNacimiento/);
});
