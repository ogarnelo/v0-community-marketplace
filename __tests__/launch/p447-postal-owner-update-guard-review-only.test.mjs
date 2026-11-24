import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(path,"utf8");
const sql=read("scripts/review_only/p447_listing_postal_owner_update_guard_candidate.sql");
const pg17=read("scripts/qa/p447-listing-postal-owner-update-guard-pg17.sh");
const old=read("supabase/migrations/20261110113419_marketplace_listing_postal_snapshot_v1.sql");
const edit=read("components/marketplace/edit-listing-form.tsx");
const publish=read("components/marketplace/new-listing-form.tsx");

test("P0 #447 candidate is review-only and cannot revoke legitimate owner edits",()=>{
 assert.match(sql,/REVIEW ONLY; never auto-install/);
 assert.match(sql,/BEGIN;/);
 assert.match(sql,/COMMIT;/);
 assert.match(sql,/lock_timeout = '5s'/);
 assert.match(sql,/NO_GO_P447_OLD_ACL_RLS_OR_POSTAL_TRIGGER_DRIFT/);
 assert.match(sql,/NO_GO_P447_AFTER_GUARD_ACL_RLS_OR_DATA_CHANGED/);
 assert.match(sql,/p447_previous_state ON COMMIT DROP/);
 assert.match(sql,/SECURITY INVOKER/);
 assert.doesNotMatch(sql,/SECURITY DEFINER|ALTER TABLE|ALTER POLICY|DROP POLICY|CREATE POLICY|TRUNCATE/);
 assert.doesNotMatch(sql,/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE)\s+ON\s+public\.listings/i);
 assert.doesNotMatch(sql,/REVOKE\s+(?:SELECT|INSERT|UPDATE|DELETE)\s+ON\s+public\.listings/i);
 assert.doesNotMatch(sql,/UPDATE\s+public\.listings\s+SET/i);
});

test("P0 #447 owner cannot directly spoof immutable CP; normal UPDATE is unaffected",()=>{
 assert.match(sql,/BEFORE UPDATE OF postal_code ON public\.listings/);
 assert.match(sql,/WHEN \(OLD\.postal_code IS DISTINCT FROM NEW\.postal_code\)/);
 assert.match(sql,/current_user = 'authenticated'/);
 assert.match(sql,/NEW\.postal_code IS DISTINCT FROM OLD\.postal_code/);
 assert.match(sql,/listing_postal_code_immutable_after_publication/);
 assert.match(sql,/ERRCODE='42501'/);
 assert.match(sql,/REVOKE ALL ON FUNCTION wetudy_internal/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/has_table_privilege\('anon','public\.listings','UPDATE'\)/);
 assert.match(sql,/has_column_privilege\(\s*'authenticated','public\.listings','postal_code','UPDATE'/);
});

test("P0 #447 preexisting before-insert snapshot stays available and verified",()=>{
 assert.match(old,/create or replace function wetudy_internal\.marketplace_listing_postal_snapshot_v1/);
 assert.match(old,/before insert on public\.listings/);
 assert.match(old,/new\.postal_code := verified_postal_code/);
 assert.match(sql,/marketplace_listing_postal_snapshot_before_insert_v1/);
 assert.doesNotMatch(sql,/DROP TRIGGER marketplace_listing_postal_snapshot_before_insert_v1/);
 assert.match(pg17,/20261110113419_marketplace_listing_postal_snapshot_v1\.sql/);
});

test("P0 #447 app edit and publish do not accept caller-supplied CP",()=>{
 const payload=edit.slice(edit.indexOf("const updatePayload = {"),
   edit.indexOf("const { data: updatedListing, error: updateError }"));
 assert.ok(payload.startsWith("const updatePayload = {"));
 assert.doesNotMatch(payload,/postal_code|lat:|lng:/);
 assert.match(edit,/\.update\(updatePayload\)/);
 const pub=publish.slice(publish.indexOf("const payload: ListingInsertPayload = {"),
   publish.indexOf("const insertion = await confirmOwnedListingInsert"));
 assert.ok(pub.startsWith("const payload: ListingInsertPayload = {"));
 assert.doesNotMatch(pub,/postal_code|lat:|lng:/);
 assert.match(publish,/confirmOwnedListingInsert/);
});

test("P0 #447 PG17 runs synthetic roles and verifies both ordinary edits and privileged correction",()=>{
 assert.match(pg17,/PGHOST=127\.0\.0\.1 PGPORT=5432 PGUSER=postgres/);
 assert.match(pg17,/wetudy_p447_postal_update_synthetic/);
 assert.match(pg17,/CREATE ROLE anon NOLOGIN/);
 assert.match(pg17,/CREATE ROLE authenticated NOLOGIN/);
 assert.match(pg17,/CREATE ROLE service_role NOLOGIN BYPASSRLS/);
 assert.match(pg17,/Normal edit or same CP was damaged/);
 assert.match(pg17,/BLOCK_POSTAL_CODE_SPOOF/);
 assert.match(pg17,/SET ROLE service_role/);
 assert.match(pg17,/Repeated candidate was accepted/);
 assert.match(pg17,/P447_PG17_PASS/);
 assert.doesNotMatch(pg17,/supabase\.co|DATABASE_URL/);
});
