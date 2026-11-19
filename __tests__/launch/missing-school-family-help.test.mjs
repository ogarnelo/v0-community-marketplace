import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("families missing a school are directed to support, not institutional access", () => {
  const onboarding = read("app/onboarding/join-school/page.tsx");
  const help = read("app/help/page.tsx");
  assert.match(onboarding, /No encontramos ningún centro con ese nombre/);
  assert.match(onboarding, /Solicitar que añadan mi colegio/);
  assert.match(onboarding, /<Link href="\/help">[\s\S]*?Solicitar que añadan mi colegio/);
  assert.match(help, /HelpContactForm/);
  assert.match(onboarding, /Continuar sin centro por ahora/);
  assert.match(onboarding, /fetch\("\/api\/schools\/public"/);
  assert.doesNotMatch(onboarding, /<Link href="\/register-school">/);
});
