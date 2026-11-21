#!/usr/bin/env bash
# Only disposable local PG17; never use a production connection string.
set -euo pipefail
unset DATABASE_URL PG service PGOPTIONS PGSERVICE PGSERVICEFILE
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=wetudy_r1_synthetic PGDATABASE=wetudy_r1_synthetic
P=(psql -X -v ON_ERROR_STOP=1 -qAt)
root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
"${P[@]}" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.user_roles(user_id uuid NOT NULL,role text NOT NULL);
CREATE TABLE public.super_admin_report_subscriptions(
 id uuid PRIMARY KEY,user_id uuid NOT NULL UNIQUE,email text NOT NULL,
 enabled boolean NOT NULL,frequency_days smallint NOT NULL,
 report_range text NOT NULL,report_format text NOT NULL,
 next_send_at timestamptz,last_sent_at timestamptz
);
GRANT USAGE ON SCHEMA public TO service_role,anon,authenticated;
GRANT SELECT ON public.user_roles TO service_role;
GRANT SELECT,UPDATE ON public.super_admin_report_subscriptions TO service_role;
INSERT INTO public.user_roles VALUES ('11111111-1111-4111-8111-111111111111','super_admin');
INSERT INTO public.super_admin_report_subscriptions VALUES
 ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','synthetic@example.invalid',true,7,'30d','pdf','2020-01-01T00:00:00Z',null);
SQL
"${P[@]}" -f "$root/docs/pilot/sql/r1_global_report_dispatch_review_only_20261121.sql"
claim="public.r1_global_report_claim('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','2020-01-01T00:00:00Z','synthetic@example.invalid',7,'30d','pdf')"
# Invalid and stale configuration must not consume the delivery slot.
bad="${claim/synthetic@example.invalid/foreign@example.invalid}"
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT coalesce($bad::text,'NONE');")" == NONE ]]
("${P[@]}" -c "SET ROLE service_role; SELECT coalesce($claim::text,'NONE');" > "$tmp/a") &
a=$!
("${P[@]}" -c "SET ROLE service_role; SELECT coalesce($claim::text,'NONE');" > "$tmp/b") &
b=$!
wait "$a"
wait "$b"
wins=0
for f in "$tmp/a" "$tmp/b"; do
 value="$(cat "$f")"
 if [[ "$value" =~ ^[0-9a-f-]{36}$ ]]; then wins=$((wins+1)); else [[ "$value" == NONE ]]; fi
done
[[ "$wins" == 1 ]]
# Unacknowledged provider attempt must remain reserved after worker exit.
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT coalesce($claim::text,'NONE');")" == NONE ]]
[[ "$("${P[@]}" -c "SELECT count(*) FROM public.r1_global_report_dispatch_claims")" == 1 ]]
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT public.r1_global_report_ack((SELECT id FROM public.r1_global_report_dispatch_claims),'synthetic-provider');")" == t ]]
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT public.r1_global_report_ack((SELECT id FROM public.r1_global_report_dispatch_claims),'duplicate-provider');")" == f ]]
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT coalesce($claim::text,'NONE');")" == NONE ]]
[[ "$("${P[@]}" -c "SELECT status||':'||provider_message_id FROM public.r1_global_report_dispatch_claims")" == accepted:synthetic-provider ]]
# Fresh schedule plus revoked role must fail, even with no claim for that date.
"${P[@]}" -c "UPDATE public.super_admin_report_subscriptions SET next_send_at='2020-01-02T00:00:00Z'; DELETE FROM public.user_roles;"
fresh="${claim/2020-01-01/2020-01-02}"
[[ "$("${P[@]}" -c "SET ROLE service_role; SELECT coalesce($fresh::text,'NONE');")" == NONE ]]
"${P[@]}" <<'SQL' > "$tmp/acl"
SELECT has_table_privilege('anon','public.r1_global_report_dispatch_claims','SELECT');
SELECT has_table_privilege('authenticated','public.r1_global_report_dispatch_claims','INSERT');
SELECT has_function_privilege('anon','public.r1_global_report_claim(uuid,uuid,timestamptz,text,integer,text,text)','EXECUTE');
SELECT has_function_privilege('authenticated','public.r1_global_report_ack(uuid,text)','EXECUTE');
SELECT relrowsecurity FROM pg_class WHERE oid='public.r1_global_report_dispatch_claims'::regclass;
SQL
[[ "$(cat "$tmp/acl")" == $'f\nf\nf\nf\nt' ]]
echo "R1 PG17: exclusive claim, stale recipient denial, no ambiguous retry, ACK fencing, revoked role and ACL/RLS PASS"
