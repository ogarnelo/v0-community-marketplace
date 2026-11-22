#!/usr/bin/env bash
# PostgreSQL 17 disposable service only. No production URLs or secrets.
set -euo pipefail
unset DATABASE_URL PGSERVICE PGSERVICEFILE PGOPTIONS
export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=wetudy_r2_grant_synthetic
export PGUSER=postgres PGPASSWORD=wetudy_r2_synthetic
P=(psql -X -v ON_ERROR_STOP=1 -qAt)
root="$(cd "$(dirname "$0")/../.." && pwd)"
"${P[@]}" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.schools(id uuid PRIMARY KEY,is_active boolean);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,school_id uuid REFERENCES public.schools(id));
CREATE TABLE public.user_roles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('super_admin','school_admin')),
 school_id uuid REFERENCES public.schools(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_roles_school_admin_unique ON public.user_roles(user_id,role,school_id)
WHERE role='school_admin' AND school_id IS NOT NULL;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
GRANT SELECT ON public.schools TO service_role;
GRANT SELECT,UPDATE ON public.profiles TO service_role;
GRANT SELECT,INSERT ON public.user_roles TO service_role;
INSERT INTO public.schools VALUES
('22222222-2222-4222-8222-222222222222',true),
('33333333-3333-4333-8333-333333333333',true),
('44444444-4444-4444-8444-444444444444',false);
INSERT INTO public.profiles(id) VALUES
('11111111-1111-4111-8111-111111111111'),
('55555555-5555-4555-8555-555555555555'),
('66666666-6666-4666-8666-666666666666');
SQL
"${P[@]}" -f "$root/docs/pilot/sql/r2_school_admin_grant_atomic_review_only_20261122.sql"
rpc="public.r2_grant_school_admin_atomic_candidate"
user="'11111111-1111-4111-8111-111111111111'"
school="'22222222-2222-4222-8222-222222222222'"
other="'33333333-3333-4333-8333-333333333333'"
false_school="'44444444-4444-4444-8444-444444444444'"
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT $rpc($user,$school);")" == t ]]
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT $rpc($user,$school);")" == t ]]
[[ "$("${P[@]}" -c "SELECT count(*) FROM public.user_roles WHERE user_id=$user AND role='school_admin';")" == 1 ]]
[[ "$("${P[@]}" -c "SELECT school_id::text FROM public.profiles WHERE id=$user;")" == 22222222-2222-4222-8222-222222222222 ]]
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT $rpc($user,$other);")" == f ]]
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT $rpc($user,$false_school);")" == f ]]
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT $rpc('77777777-7777-4777-8777-777777777777',$school);")" == f ]]
[[ "$("${P[@]}" -c "SELECT count(*) FROM public.user_roles;")" == 1 ]]
# A trigger-induced profile failure MUST rollback the newly inserted role.
"${P[@]}" <<'SQL'
CREATE FUNCTION public.fail_r2_profile_update_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id='55555555-5555-4555-8555-555555555555'
 THEN RAISE EXCEPTION 'synthetic_profile_update_failure'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER r2_fail_profile BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.fail_r2_profile_update_fixture();
SQL
if "${P[@]}" -c "SET ROLE service_role; SELECT $rpc('55555555-5555-4555-8555-555555555555',$school);" >/dev/null 2>&1; then
 echo "Rollback expected" >&2; exit 1
fi
[[ "$("${P[@]}" -c "SELECT count(*) FROM public.user_roles WHERE user_id='55555555-5555-4555-8555-555555555555';")" == 0 ]]
"${P[@]}" -c "DROP TRIGGER r2_fail_profile ON public.profiles;" >/dev/null
# Two concurrent requests for different schools for the SAME user have exactly one winner.
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
("${P[@]}" -c "SET ROLE service_role; SELECT $rpc('66666666-6666-4666-8666-666666666666',$school);" >"$tmp/a") &
pa=$!
("${P[@]}" -c "SET ROLE service_role; SELECT $rpc('66666666-6666-4666-8666-666666666666',$other);" >"$tmp/b") &
pb=$!
wait "$pa"; wait "$pb"
[[ "$(cat "$tmp/a" "$tmp/b" | grep -c '^t$')" == 1 ]]
[[ "$(cat "$tmp/a" "$tmp/b" | grep -c '^f$')" == 1 ]]
[[ "$("${P[@]}" -c "SELECT count(*) FROM public.user_roles WHERE user_id='66666666-6666-4666-8666-666666666666';")" == 1 ]]
[[ "$("${P[@]}" -c "SELECT count(*) FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id WHERE r.role='school_admin' AND p.school_id IS DISTINCT FROM r.school_id;")" == 0 ]]
[[ "$("${P[@]}" -c "SELECT has_function_privilege('anon','public.r2_grant_school_admin_atomic_candidate(uuid,uuid)','EXECUTE')::text || ':' || has_function_privilege('authenticated','public.r2_grant_school_admin_atomic_candidate(uuid,uuid)','EXECUTE')::text || ':' || has_function_privilege('service_role','public.r2_grant_school_admin_atomic_candidate(uuid,uuid)','EXECUTE')::text || ':' || (SELECT prosecdef::text FROM pg_proc WHERE oid='public.r2_grant_school_admin_atomic_candidate(uuid,uuid)'::regprocedure);")" == false:false:true:false ]]
# Direct school status UPDATE is protected by the new trigger even when
# the application does not use an RPC for toggling.
"${P[@]}" <<'SQL'
INSERT INTO public.schools VALUES
('99999999-9999-4999-8999-999999999999',true);
INSERT INTO public.profiles(id) VALUES
('88888888-8888-4888-8888-888888888888');
SQL
status_school="'99999999-9999-4999-8999-999999999999'"
status_user="'88888888-8888-4888-8888-888888888888'"
# Deactivation wins first: grant must wait for the trigger lock and then deny.
("${P[@]}" -c "BEGIN; UPDATE public.schools SET is_active=false WHERE id=$status_school; SELECT pg_sleep(1); COMMIT;" >"$tmp/toggle") &
toggle_pid=$!
sleep 0.25
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT $rpc($status_user,$status_school);")" == f ]]
wait "$toggle_pid"
[[ "$("${P[@]}" -c "SELECT count(*) FROM public.user_roles WHERE user_id=$status_user;")" == 0 ]]
# Reverse order: a committed grant may precede deactivation, but the two
# transactions cannot overlap in their activation decision.
"${P[@]}" -c "UPDATE public.schools SET is_active=true WHERE id=$status_school;" >/dev/null
("${P[@]}" -c "BEGIN; SET ROLE service_role; SELECT $rpc($status_user,$status_school); SELECT pg_sleep(1); COMMIT;" >"$tmp/grant") &
grant_pid=$!
sleep 0.25
"${P[@]}" -c "UPDATE public.schools SET is_active=false WHERE id=$status_school;" >/dev/null
wait "$grant_pid"
[[ "$(grep -c '^t
 "$tmp/grant")" == 1 ]]
[[ "$("${P[@]}" -c "SELECT count(*) FROM public.user_roles WHERE user_id=$status_user;")" == 1 ]]
[[ "$("${P[@]}" -c "SELECT is_active::text FROM public.schools WHERE id=$status_school;")" == false ]]
[[ "$("${P[@]}" -c "SELECT has_function_privilege('anon','public.r2_school_active_transition_lock_candidate()','EXECUTE')::text || ':' || has_function_privilege('authenticated','public.r2_school_active_transition_lock_candidate()','EXECUTE')::text;")" == false:false ]]
echo "R2 PASS: idempotency, rollback, conflicting schools, ACL, both orders of active-toggle concurrency"
