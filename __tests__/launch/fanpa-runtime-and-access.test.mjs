import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { countSchoolStudents, getSchoolMemberIds } from "../../lib/reports/school-membership.ts";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const source = read("lib/fanpa/federation-kpis.ts");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const mod = { exports: {} };
vm.runInNewContext(compiled.outputText, {
  module: mod,
  exports: mod.exports,
  require(specifier) {
    assert.equal(specifier, "@/lib/reports/school-membership");
    return { countSchoolStudents, getSchoolMemberIds };
  },
});
const { computeFederationKpis } = mod.exports;

test("FANPA figures count every school but deduplicate multi-school families", () => {
  const actual = computeFederationKpis({
    schools: [{ id: "school-a", name: "Cole A" }, { id: "school-b", name: "Cole B" }],
    profiles: [{ id: "family-1", school_id: "school-a" }, { id: "family-2", school_id: "school-b" }],
    students: [
      { owner_user_id: "family-1", school_id: "school-a" },
      { owner_user_id: "family-1", school_id: "school-b" },
      { owner_user_id: "family-1", school_id: "school-a" },
      { owner_user_id: "family-2", school_id: "school-b" },
    ],
    admins: [{ user_id: "school-admin", school_id: "school-a" }],
    listings: [
      { id: "listing-1", school_id: "school-a", status: "available" },
      { id: "listing-2", school_id: "school-b", status: "reserved" },
      { id: "listing-3", school_id: "school-b", status: "sold" },
    ],
    demands: [
      { id: "need-1", school_id: "school-a", status: "open" },
      { id: "need-2", school_id: "school-b", status: "matched" },
      { id: "need-3", school_id: "school-b", status: "dismissed" },
    ],
    agreements: [
      { id: "agreement-1", school_id: "school-a", status: "confirmed" },
      { id: "agreement-2", school_id: "school-b", status: "pending" },
    ],
  });
  assert.equal(actual.totalSchools, 2);
  assert.equal(actual.uniqueUsers, 3); // family-1, family-2, school-admin
  assert.equal(actual.students, 4);
  assert.equal(actual.activeListings, 2);
  assert.equal(actual.totalListings, 3);
  assert.equal(actual.openDemands, 2);
  assert.equal(actual.confirmedExchanges, 1);
  assert.deepEqual(actual.schools.map((school) => school.users), [2,2]);
  assert.equal("profiles" in actual, false); // no private identifiers in result
});

test("FANPA page requires both role and explicit federation membership", () => {
  const page = read("app/admin/fanpa/page.tsx");
  assert.match(page, /eq\("role", "fanpa_admin"\)/);
  assert.match(page, /from\("federation_admins"\)/);
  assert.match(page, /eq\("user_id", user.id\)/);
  assert.match(page, /if \(roleError \|\| membershipsError \|\| !role\) redirect/);
  assert.match(page, /\.eq\("is_test",false\)/);
  assert.match(page, /\.in\("id",schoolIds\)/);
  assert.match(page, /\.in\("school_id",validIds\)/);
  assert.match(page, /metrics.schools.find\(\(school\) => school.id === selectedSchool\)/);
  assert.doesNotMatch(page, /select\(".*full_name/);
  assert.match(page, /MIN_PRIVATE_KPI_COHORT = 5/);
  assert.match(page, /hideSensitive/);
  assert.match(page, /safeSensitiveKpi\(row.openDemands,row.users\)/);
});

test("FANPA tables are service-only with strict scoped role", () => {
  const migration = read("supabase/migrations/20261107192000_fanpa_federations_foundation.sql");
  assert.match(migration, /ALTER TABLE public.federation_admins ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON public.federations, public.federation_schools, public.federation_admins/);
  assert.match(migration, /fanpa_admin/);
  assert.match(migration, /REFERENCES public.schools\(id\)/);
  const roles=read("lib/admin/roles.ts");
  const navbar=read("lib/navbar/get-navbar-data.ts");
  assert.match(roles, /isFanpaAdmin/);
  assert.match(navbar, /adminFlags.isFanpaAdmin/);
});
