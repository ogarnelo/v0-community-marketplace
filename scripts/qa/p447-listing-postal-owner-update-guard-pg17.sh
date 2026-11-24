#!/usr/bin/env bash
set -euo pipefail
# WETUDY P0 #447. Disposable PostgreSQL 17 only; never use production credentials.
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres
export PGPASSWORD=wetudy_synthetic_pg17 PGCONNECT_TIMEOUT=5
DB=wetudy_p447_postal_update_synthetic
CANDIDATE=scripts/review_only/p447_listing_postal_owner_update_guard_candidate.sql
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
[[ -f "$CANDIDATE" ]] || { echo "No review-only candidate" >&2; exit 1; }
createdb "$DB"
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS wetudy_internal;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
SET search_path='' AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon,service_role;
CREATE TABLE public.listings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 seller_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'available',
 title text NOT NULL,
 postal_code text,
 is_demo boolean NOT NULL DEFAULT false
);
CREATE TABLE public.profiles(id uuid PRIMARY KEY, postal_code text);
CREATE TABLE public.marketplace_postal_centroids(postal_code text PRIMARY KEY);
INSERT INTO public.marketplace_postal_centroids(postal_code)
 VALUES ('28001'),('08001'),('04001');
INSERT INTO public.profiles(id,postal_code)
 VALUES ('22222222-2222-4222-8222-222222222222','28001');
GRANT INSERT,UPDATE,DELETE ON public.listings TO authenticated;
GRANT SELECT(id,seller_id,status,title) ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY listings_select_available_public ON public.listings FOR SELECT
 TO public USING(status='available');
CREATE POLICY listings_select_owner ON public.listings FOR SELECT
 TO authenticated USING((SELECT auth.uid())=seller_id);
CREATE POLICY listings_insert_owner ON public.listings FOR INSERT
 TO authenticated WITH CHECK((SELECT auth.uid())=seller_id);
CREATE POLICY listings_update_owner ON public.listings FOR UPDATE
 TO authenticated USING((SELECT auth.uid())=seller_id)
 WITH CHECK((SELECT auth.uid())=seller_id);
CREATE POLICY listings_delete_owner ON public.listings FOR DELETE
 TO authenticated USING((SELECT auth.uid())=seller_id);
SQL
# Use the ACTUAL previous PostgreSQL migration so the new guard proves
# compatibility with its published-time validation and existing trigger.
psql -X -v ON_ERROR_STOP=1 -d "$DB" \
  -f supabase/migrations/20261110113419_marketplace_listing_postal_snapshot_v1.sql >"$T/initial"
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f "$CANDIDATE" >"$T/install"

acl=$(psql -XAt -d "$DB" -c "SELECT
(has_table_privilege('anon','public.listings','INSERT'))::int||':'||
(has_table_privilege('anon','public.listings','UPDATE'))::int||':'||
(has_table_privilege('anon','public.listings','DELETE'))::int||':'||
(has_column_privilege('authenticated','public.listings','postal_code','SELECT'))::int||':'||
(has_column_privilege('authenticated','public.listings','postal_code','UPDATE'))::int||':'||
(has_function_privilege('authenticated',
  'wetudy_internal.marketplace_listing_postal_owner_update_guard_v1()','EXECUTE'))::int")
[[ "$acl" == "0:0:0:0:1:0" ]] || {
 echo "Unexpected ACL $acl" >&2;exit 1;
}

# Authenticated owner publishes an explicit false postcode: previous trigger
# MUST write the verified profile postcode instead, and preserve the owner.
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
 '22222222-2222-4222-8222-222222222222',false);
INSERT INTO public.listings(id,seller_id,title,status,postal_code)
VALUES('11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 'Texto para clase','available','08001');
SQL
initial=$(psql -XAt -d "$DB" -c "SELECT postal_code FROM public.listings
WHERE id='11111111-1111-4111-8111-111111111111'")
[[ "$initial" == "28001" ]] || {
 echo "Before-insert snapshot regression $initial" >&2;exit 1;
}

# Ordinary edits remain allowed. No backend or client interface changes.
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
 '22222222-2222-4222-8222-222222222222',false);
UPDATE public.listings SET title='Texto actualizado'
WHERE id='11111111-1111-4111-8111-111111111111';
-- UPDATE specifying the SAME postal code is harmless and succeeds.
UPDATE public.listings SET postal_code='28001'
WHERE id='11111111-1111-4111-8111-111111111111';
SQL
title=$(psql -XAt -d "$DB" -c "SELECT title||':'||postal_code
FROM public.listings WHERE id='11111111-1111-4111-8111-111111111111'")
[[ "$title" == "Texto actualizado:28001" ]] || {
 echo "Normal edit or same CP was damaged $title" >&2;exit 1;
}

# Authenticated direct UPDATE trying to spoof an arbitrary / valid CP is
# rejected with an explicit SQLSTATE. No change to the verified location.
if psql -X -v ON_ERROR_STOP=1 -d "$DB" >"$T/blocked" 2>&1 <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
 '22222222-2222-4222-8222-222222222222',false);
UPDATE public.listings SET postal_code='08001'
WHERE id='11111111-1111-4111-8111-111111111111';
SQL
then echo "BLOCK_POSTAL_CODE_SPOOF unexpectedly allowed" >&2;exit 1; fi
grep -q "listing_postal_code_immutable_after_publication" "$T/blocked" || {
 cat "$T/blocked";exit 1;
}
unchanged=$(psql -XAt -d "$DB" -c "SELECT postal_code FROM public.listings
WHERE id='11111111-1111-4111-8111-111111111111'")
[[ "$unchanged" == "28001" ]] || {
 echo "Rejected spoof modified CP" >&2;exit 1;
}

# Another authenticated family cannot edit the original owner's fields.
foreign=$(psql -XAt -d "$DB" <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
 '33333333-3333-4333-8333-333333333333',false);
UPDATE public.listings SET title='Hacked'
WHERE id='11111111-1111-4111-8111-111111111111';
SELECT title FROM public.listings WHERE id='11111111-1111-4111-8111-111111111111';
SQL
)
echo "$foreign" | grep -q "UPDATE 0" || {
 echo "Foreign owner RLS unexpected: $foreign" >&2;exit 1;
}

# Only the explicit privileged import path may correct historic postcodes.
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET ROLE service_role;
UPDATE public.listings SET postal_code='04001'
WHERE id='11111111-1111-4111-8111-111111111111';
SQL
corrected=$(psql -XAt -d "$DB" -c "SELECT postal_code FROM public.listings
WHERE id='11111111-1111-4111-8111-111111111111'")
[[ "$corrected" == "04001" ]] || {
 echo "Service import correction unexpectedly blocked" >&2;exit 1;
}

# Drifted repeated installation must fail closed, without changing state.
if psql -X -v ON_ERROR_STOP=1 -d "$DB" \
 -f "$CANDIDATE" >"$T/reapply" 2>&1;then
  echo "Repeated candidate was accepted" >&2;exit 1
fi
grep -q 'NO_GO_P447_OLD_ACL_RLS_OR_POSTAL_TRIGGER_DRIFT' "$T/reapply" || {
 cat "$T/reapply";exit 1;
}
after=$(psql -XAt -d "$DB" -c "SELECT postal_code FROM public.listings
WHERE id='11111111-1111-4111-8111-111111111111'")
[[ "$after" == "04001" ]] || { echo "Failed reapply changed rows";exit 1; }
echo "P447_PG17_PASS: anon DML denied, owner write + insert snapshot, CP immutable on update, foreign deny, privileged import, drift fail-closed — SYNTHETIC ONLY"
