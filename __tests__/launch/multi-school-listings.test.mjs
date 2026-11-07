import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(path)=>readFileSync(new URL(`../../${path}`,import.meta.url),"utf8");
const page=read("app/marketplace/new/page.tsx");
const form=read("components/marketplace/new-listing-form.tsx");
const migration=read("supabase/migrations/20261107210000_listing_school_association_guard.sql");

test("published listings may choose one of all authorized student schools",()=>{
  assert.match(page,/\.from\("account_students"\)/);
  assert.match(page,/\.eq\("active", true\)/);
  assert.match(page,/Array\.from\(new Set/);
  assert.match(page,/availableSchools/);
  assert.match(form,/availableSchools\.map\(\(school\) =>/);
  assert.match(form,/onValueChange=\{setSelectedSchoolId\}/);
  assert.match(form,/school_id: effectiveSchoolId/);
});
test("no required student picker, optional general material",()=>{
  assert.match(form,/value="no-school"/);
  assert.match(form,/No es necesario seleccionar un estudiante/);
  assert.match(form,/selectedSchoolId === "no-school" \? null : selectedSchoolId/);
});
test("school admins still publish only to their managed school",()=>{
  assert.match(form,/if \(isSchoolAdmin && effectiveSchoolId !== initialSchoolId\)/);
  assert.match(page,/managedSchoolId/);
});
test("database prevents forged school associations and preserves old listings",()=>{
  assert.match(migration,/SECURITY DEFINER/);
  assert.match(migration,/auth\.uid\(\)/);
  assert.match(migration,/NEW\.seller_id IS DISTINCT FROM actor/);
  assert.match(migration,/a\.owner_user_id = actor AND a\.active = true AND a\.school_id = NEW\.school_id/);
  assert.match(migration,/NEW\.school_id IS NOT DISTINCT FROM OLD\.school_id/);
  assert.match(migration,/CREATE TRIGGER validate_listing_school_context/);
  assert.match(migration,/REVOKE ALL ON FUNCTION private\.enforce_listing_school_context/);
});
