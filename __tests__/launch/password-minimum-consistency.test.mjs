import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
test("all password creation and change forms require 12 characters", () => {
  const paths = [
    "components/auth/auth-form.tsx",
    "components/auth/update-password-form.tsx",
    "components/account/change-password-form.tsx",
    "components/auth/complete-school-invite-form.tsx",
  ];
  for (const path of paths) {
    const content = read(path);
    assert.match(content, /password\.length < 12/, path);
    assert.doesNotMatch(content, /minLength=\{8\}/, path);
    assert.doesNotMatch(content, /al menos 8 caracteres|Mínimo 8 caracteres|Usa al menos 8 caracteres/, path);
  }
});
