#!/usr/bin/env bash
# Isolated disposable PG17 only. Never ingest production databases/secrets.
set -euo pipefail
unset DATABASE_URL PGSERVICE PGSERVICEFILE PGOPTIONS
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=wetudy_r2_synthetic PGDATABASE=wetudy_r2_synthetic
P=(psql -X -v ON_ERROR_STOP=1 -qAt)
root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
"${P[@]}" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,user_type text NOT NULL);
CREATE TABLE public.account_students(
 id uuid PRIMARY KEY,owner_user_id uuid NOT NULL REFERENCES public.profiles(id),
 relationship text NOT NULL CHECK(relationship IN('self','guardian')),
 active boolean NOT NULL,is_primary boolean NOT NULL,
 sort_order smallint NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_primary ON public.account_students(owner_user_id) WHERE is_primary AND active;
CREATE UNIQUE INDEX one_active_self ON public.account_students(owner_user_id) WHERE relationship='self' AND active;
ALTER TABLE public.account_students ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role,anon,authenticated;
GRANT SELECT,UPDATE ON public.profiles,public.account_students TO service_role;
INSERT INTO public.profiles VALUES
('11111111-1111-4111-8111-111111111111','parent'),
('22222222-2222-4222-8222-222222222222','student'),
('33333333-3333-4333-8333-333333333333','parent');
INSERT INTO public.account_students(id,owner_user_id,relationship,active,is_primary,sort_order) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','guardian',true,true,0),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','guardian',true,false,1),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','guardian',true,false,2),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','self',true,true,0),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','33333333-3333-4333-8333-333333333333','guardian',true,true,0);
SQL
"${P[@]}" -f "$root/docs/pilot/sql/r2_account_student_deactivate_atomic_review_only_20261122.sql"
fn="public.r2_deactivate_student_and_promote_candidate"
owner="'11111111-1111-4111-8111-111111111111'"
first="'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"
second="'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'"
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT $fn($owner,$first);")" == t ]]
[[ "$("${P[@]}" -c "SELECT id::text FROM public.account_students WHERE owner_user_id=$owner AND active AND is_primary")" == bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb ]]
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT $fn($owner,$first);")" == f ]]
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT $fn('22222222-2222-4222-8222-222222222222','dddddddd-dddd-4ddd-8ddd-dddddddddddd');")" == f ]]
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT $fn($owner,'dddddddd-dddd-4ddd-8ddd-dddddddddddd');")" == f ]]
# A failed promotion rolls back the preceding deactivation in same transaction.
"${P[@]}" <<'SQL'
CREATE FUNCTION public.r2_fixture_fail_promote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' AND NEW.is_primary AND NOT OLD.is_primary
 THEN RAISE EXCEPTION 'synthetic_promotion_failure'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER r2_fail_promote BEFORE UPDATE ON public.account_students FOR EACH ROW
EXECUTE FUNCTION public.r2_fixture_fail_promote();
SQL
if "${P[@]}" -c "SET ROLE service_role; SELECT $fn($owner,$second);" > "$tmp/error" 2>&1; then
 echo "Expected synthetic promotion failure, but operation committed" >&2; exit 1
fi
[[ "$("${P[@]}" -c "SELECT active::text||':'||is_primary::text FROM public.account_students WHERE id=$second")" == true:true ]]
[[ "$("${P[@]}" -c "SELECT count(*) FROM public.account_students WHERE owner_user_id=$owner AND active AND is_primary")" == 1 ]]
"${P[@]}" -c "DROP TRIGGER r2_fail_promote ON public.account_students;"
# Concurrent calls to remove same parent primary produce exactly one winner.
("${P[@]}" -c "SET ROLE service_role; SELECT $fn($owner,$second);" > "$tmp/a") &
pa=$!
("${P[@]}" -c "SET ROLE service_role; SELECT $fn($owner,$second);" > "$tmp/b") &
pb=$!
wait "$pa";wait "$pb"
[[ "$(cat "$tmp/a" "$tmp/b" | grep -c '^t$')" == 1 ]]
[[ "$(cat "$tmp/a" "$tmp/b" | grep -c '^f$')" == 1 ]]
[[ "$("${P[@]}" -c "SELECT id::text FROM public.account_students WHERE owner_user_id=$owner AND active AND is_primary")" == cccccccc-cccc-4ccc-8ccc-cccccccccccc ]]
[[ "$("${P[@]}" -c "SELECT count(*) FROM public.account_students WHERE owner_user_id=$owner AND active AND is_primary")" == 1 ]]
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT $fn($owner,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');")" == t ]]
[[ "$("${P[@]}" -c "SELECT count(*) FROM public.account_students WHERE owner_user_id=$owner AND active")" == 0 ]]
"${P[@]}" <<'SQL' > "$tmp/acl"
SELECT has_function_privilege('anon','public.r2_deactivate_student_and_promote_candidate(uuid,uuid)','EXECUTE');
SELECT has_function_privilege('authenticated','public.r2_deactivate_student_and_promote_candidate(uuid,uuid)','EXECUTE');
SELECT has_function_privilege('service_role','public.r2_deactivate_student_and_promote_candidate(uuid,uuid)','EXECUTE');
SELECT prosecdef FROM pg_proc WHERE oid='public.r2_deactivate_student_and_promote_candidate(uuid,uuid)'::regprocedure;
SQL
[[ "$(cat "$tmp/acl")" == $'f\nf\nt\nf' ]]
echo "R2 PG17 PASS: promotion, idempotent denial, cross-owner denial, self denial, rollback, concurrent winner, ACL"
