import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const joinSchoolPage = fs.readFileSync("app/onboarding/join-school/page.tsx", "utf8");

describe("optional school onboarding contract", () => {
  it("lets users continue even when school linking is not ready", () => {
    assert.match(joinSchoolPage, /Continuar sin centro por ahora/);
    assert.match(joinSchoolPage, /añadirlo después/);
    assert.match(joinSchoolPage, /router\.push\("\/marketplace"\)/);
  });

  it("keeps school linking available as a recommended step", () => {
    assert.match(joinSchoolPage, /Código del centro/);
    assert.match(joinSchoolPage, /No tengo código, buscar centro/);
    assert.match(joinSchoolPage, /Registrar nuevo centro/);
  });
});
