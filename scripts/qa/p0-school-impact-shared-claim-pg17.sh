#!/usr/bin/env bash
# Isolated PG17 integration harness. No Supabase credentials, no live data.
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=wetudy_synthetic_pg17 PGDATABASE=postgres
PSQL=(psql -X -v ON_ERROR_STOP=1 -q)
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SQL="$ROOT/docs/pilot/sql/p0_school_impact_shared_claim_review_only_20261119.sql"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
"${PSQL[@]}" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.schools(id uuid PRIMARY KEY, is_active boolean NOT NULL);
CREATE TABLE public.user_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  role text NOT NULL, school_id uuid);
CREATE TABLE public.school_impact_report_subscriptions(
 id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES public.schools(id),
 user_id uuid NOT NULL, email text NOT NULL, enabled boolean NOT NULL,
 day_of_month smallint NOT NULL, last_sent_month text,
 UNIQUE (school_id,user_id)
);
CREATE TABLE public.school_impact_report_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL,user_id uuid,
 period_key text NOT NULL
);
GRANT USAGE ON SCHEMA public TO service_role,anon,authenticated;
GRANT SELECT ON public.schools,public.user_roles,public.school_impact_report_subscriptions,
  public.school_impact_report_deliveries TO service_role;
-- SELECT ... FOR UPDATE requires UPDATE privilege on the locked table.
-- Production service_role UPDATE permission was verified READ ONLY.
GRANT UPDATE ON public.school_impact_report_subscriptions TO service_role;
INSERT INTO public.schools(id,is_active) VALUES
 ('11111111-1111-4111-8111-111111111111',true),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
INSERT INTO public.user_roles(user_id,role,school_id) VALUES
 ('22222222-2222-4222-8222-222222222222','school_admin','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','school_admin','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.school_impact_report_subscriptions(
 id,school_id,user_id,email,enabled,day_of_month,last_sent_month) VALUES
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222','school@example.invalid',true,19,null);
SQL
# Parse and execute the EXACT review-only SQL in this disposable PostgreSQL.
"${PSQL[@]}" -f "$SQL"

# Service calls for the same (school,user,month) race from two independent sessions.
manual="SELECT coalesce(public.p0_school_impact_shared_claim_candidate(
'11111111-1111-4111-8111-111111111111',
'22222222-2222-4222-8222-222222222222','2026-10','school@example.invalid',
'manual',null,null,null)::text,'NONE');"
cron="SELECT coalesce(public.p0_school_impact_shared_claim_candidate(
'11111111-1111-4111-8111-111111111111',
'22222222-2222-4222-8222-222222222222','2026-10','school@example.invalid',
'cron','33333333-3333-4333-8333-333333333333',19,null)::text,'NONE');"
("${PSQL[@]}" -At -c "SET ROLE service_role; $manual" > "$tmp/manual") &
pa=$!
("${PSQL[@]}" -At -c "SET ROLE service_role; $cron" > "$tmp/cron") &
pb=$!
wait "$pa"
wait "$pb"
wins=0
for f in "$tmp/manual" "$tmp/cron"; do
  value="$(tail -n 1 "$f")"
  if [[ "$value" != "NONE" && "$value" =~ ^[0-9a-f-]{36}$ ]]; then
    wins=$((wins+1))
  elif [[ "$value" != "NONE" ]]; then
    echo "Unexpected claim response (redacted)" >&2
    exit 1
  fi
done
[[ "$wins" -eq 1 ]] || { echo "Manual+cron race did not produce exactly one winner" >&2; exit 1; }

# No-subscription manual claim must work, for independent user/school.
"${PSQL[@]}" -At <<'SQL' > "$tmp/independent"
SET ROLE service_role;
SELECT coalesce(public.p0_school_impact_shared_claim_candidate(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '2026-10','manual@example.invalid','manual',null,null,null)::text,'NONE');
SQL
[[ "$(tail -n 1 "$tmp/independent")" != "NONE" ]] || {
 echo "Manual report without subscription was blocked" >&2; exit 1;
}

# Reclaiming either key is denied; row counts stay exactly two.
"${PSQL[@]}" -At <<'SQL' > "$tmp/checks"
SET ROLE service_role;
SELECT count(*) FROM public.p0_school_impact_shared_dispatch_claims_candidate;
SELECT coalesce(public.p0_school_impact_shared_claim_candidate(
 '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
 '2026-10','school@example.invalid','manual',null,null,null)::text,'NONE');
SELECT public.p0_school_impact_shared_ack_candidate(
 (SELECT id FROM public.p0_school_impact_shared_dispatch_claims_candidate LIMIT 1),
 'synthetic-provider-id');
SELECT count(*) FROM public.p0_school_impact_shared_dispatch_claims_candidate
 WHERE status='accepted';
SQL
[[ "$(head -n 1 "$tmp/checks")" == "2" ]] || { echo "Claim count mismatch" >&2; exit 1; }
[[ "$(sed -n '2p' "$tmp/checks")" == "NONE" ]] || { echo "Duplicate claim accepted" >&2; exit 1; }
[[ "$(sed -n '3p' "$tmp/checks")" == "t" ]] || { echo "ACK failed" >&2; exit 1; }
[[ "$(sed -n '4p' "$tmp/checks")" == "1" ]] || { echo "ACK status incorrect" >&2; exit 1; }

# Deny service-less clients even when their role can access the public schema.
"${PSQL[@]}" -At <<'SQL' > "$tmp/acl"
SELECT has_function_privilege('anon',
 'public.p0_school_impact_shared_claim_candidate(uuid,uuid,text,text,text,uuid,int,text)','EXECUTE');
SELECT has_function_privilege('authenticated',
 'public.p0_school_impact_shared_ack_candidate(uuid,text)','EXECUTE');
SELECT has_table_privilege('anon',
 'public.p0_school_impact_shared_dispatch_claims_candidate','SELECT');
SELECT relrowsecurity FROM pg_class WHERE oid=
 'public.p0_school_impact_shared_dispatch_claims_candidate'::regclass;
SQL
[[ "$(cat "$tmp/acl")" == $'f\nf\nf\nt' ]] || { echo "ACL/RLS postflight mismatch" >&2; exit 1; }
echo "PG17 shared school impact claim: isolated manual/cron concurrency, manual without subscription, ACK and ACL PASS"
