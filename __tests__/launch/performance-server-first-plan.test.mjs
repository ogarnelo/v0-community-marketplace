import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const plan = fs.readFileSync("docs/PERFORMANCE_MARKETPLACE_SERVER_FIRST_PLAN.md", "utf8");

describe("marketplace performance plan", () => {
  it("documents server-first as the next marketplace optimization", () => {
    assert.match(plan, /server-first/);
    assert.match(plan, /initialListings/);
    assert.match(plan, /tiempo hasta ver el primer grid de anuncios/);
  });
});
