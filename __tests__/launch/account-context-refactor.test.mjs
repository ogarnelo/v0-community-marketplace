import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profile = readFileSync("components/account/account-profile-form.tsx", "utf8");
const section = readFileSync("components/account/account-students-section.tsx", "utf8");
const fields = readFileSync("components/account-students/student-context-fields.tsx", "utf8");
const studentService = readFileSync("lib/account-students/server.ts", "utf8");
const typeRoute = readFileSync("app/api/account/type/route.ts", "utf8");
const confirmRoute = readFileSync("app/auth/confirm/route.ts", "utf8");
const authForm = readFileSync("components/auth/auth-form.tsx", "utf8");

test("Mi perfil keeps account-holder and contact data but no educational fields", () => {
  assert.match(profile, /Nombre/);
  assert.match(profile, /Apellidos/);
  assert.match(profile, /Email/);
  assert.match(profile, /Tipo de usuario/);
  assert.match(profile, /Código postal/);
  assert.match(profile, /Datos opcionales de contacto/);

  assert.doesNotMatch(profile, /Curso \/ nivel/);
  assert.doesNotMatch(profile, /<Label>Centro educativo<\/Label>/);
  assert.doesNotMatch(profile, /grade_level:/);
  assert.doesNotMatch(profile, /school_id:/);
});

test("student educational context has no alias and includes center search code and course", () => {
  assert.match(section, /Mi contexto educativo/);
  assert.match(section, /showAlias=\{false\}/);
  assert.match(fields, /Centro educativo/);
  assert.match(fields, /Busca por nombre, ciudad o CP/);
  assert.match(fields, /Código de centro/);
  assert.match(fields, /Introduce un código/);
  assert.match(fields, /Aplicar/);
  assert.match(fields, /Curso/);
  assert.match(
    fields,
    /Puedes dejar este campo vacío y guardar para no pertenecer a ningún centro/
  );
});

test("family student editor keeps optional alias", () => {
  assert.match(section, /<StudentContextFields[\s\S]*showAlias[\s\S]*alias=\{draft\.alias\}/);
  assert.match(fields, /Nombre o alias/);
  assert.match(fields, /\(opcional\)/);
});

test("school is optional but course remains required in the student API", () => {
  assert.match(studentService, /schoolId: string \| null/);
  assert.match(studentService, /const schoolId = cleanText\(body\?\.schoolId, 64\) \|\| null/);
  assert.match(studentService, /if \(schoolId && !UUID_RE\.test\(schoolId\)\)/);
  assert.match(studentService, /if \(!gradeLevel\)/);
  assert.match(studentService, /accountType === "student" \? null : input\.alias/);
});

test("personal account type changes adapt the existing educational context safely", () => {
  assert.match(profile, /\/api\/account\/type/);
  assert.match(typeRoute, /targetType === "student" && activeStudents\.length > 1/);
  assert.match(typeRoute, /relationship: "self"/);
  assert.match(typeRoute, /alias: null/);
  assert.match(typeRoute, /relationship: "guardian"/);
  assert.match(typeRoute, /updateUserById/);
  assert.match(typeRoute, /Tus datos anteriores se han conservado/);
});

test("email confirmation and later login cannot silently skip required educational onboarding", () => {
  assert.match(confirmRoute, /fallbackDestination[\s\S]*"\/onboarding\/students"/);
  assert.match(confirmRoute, /safeNext === "\/onboarding\/join-school"/);
  assert.match(confirmRoute, /"\/onboarding\/students"/);
  assert.match(authForm, /fetch\("\/api\/account\/students"/);
  assert.match(authForm, /students\.length === 0/);
  assert.match(authForm, /\/onboarding\/students/);
});
