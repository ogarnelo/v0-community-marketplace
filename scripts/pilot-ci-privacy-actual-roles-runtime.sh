#!/usr/bin/env bash
# WETUDY #447: PostgreSQL17 REAL runtime permission check on synthetic CI only.
# Must run AFTER select and DML revoke proposals inside disposable CI service.
set -euo pipefail
if [[ "${WETUDY_SYNTHETIC_POSTGRES_CI:-}" != "yes" ||
      "${PGHOST:-}" != "127.0.0.1" ||
      "${PGUSER:-}" != "postgres" ||
      "${PGPASSWORD:-}" != "ci_synthetic_only_not_secret" ||
      "${PGPORT:-}" != "5432" ]]; then
  echo "NO_GO_PG17_PRIVACY_RUNTIME: NON_CI_ENV" >&2
  exit 2
fi
database="wetudy_privacy_ci"
psql_ci() {
  psql -X -v ON_ERROR_STOP=1 -d "$database" "$@"
}
actual_db="$(psql_ci -Atc 'SELECT current_database()')"
if [[ "$actual_db" != "$database" ]]; then
  echo "NO_GO_PG17_PRIVACY_RUNTIME: WRONG_DATABASE" >&2
  exit 2
fi
# Owner SELECT temporarily enables meaningful update checks.
psql_ci >/dev/null <<'SQL'
BEGIN;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE POLICY synthetic_owner_read ON public.listings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
INSERT INTO public.listings (id,postal_code,user_id,status)
 VALUES (2,'22222','22222222-2222-4222-8222-222222222222','available');
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.listings (id,postal_code,user_id,status)
 VALUES (1,'11111','11111111-1111-4111-8111-111111111111','available');
UPDATE public.listings SET postal_code='33333' WHERE id=1;
UPDATE public.listings SET postal_code='99999' WHERE id=2;
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.listings) <> 1
   OR NOT EXISTS (SELECT 1 FROM public.listings WHERE id=1 AND postal_code='33333') THEN
  RAISE EXCEPTION 'Authenticated owner CP editing / isolation failed';
 END IF;
END $check$;
RESET ROLE;
DO $check$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.listings WHERE id=2 AND postal_code='22222')
   OR NOT EXISTS (SELECT 1 FROM public.listings WHERE id=1 AND postal_code='33333') THEN
  RAISE EXCEPTION 'Cross-owner update or owner CP edit incorrect';
 END IF;
END $check$;
ROLLBACK;
SQL
expect_permission_denied() {
  local operation="$1"
  local output
  if output="$(psql -X -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate \
       -d "$database" -c "BEGIN; SET LOCAL ROLE anon; $operation; ROLLBACK;" 2>&1)"; then
    echo "NO_GO_PG17_PRIVACY_RUNTIME: ANON_OPERATION_ALLOWED" >&2
    exit 3
  fi
  if ! grep -q '42501' <<< "$output"; then
    echo "NO_GO_PG17_PRIVACY_RUNTIME: UNEXPECTED_SQL_FAILURE" >&2
    exit 4
  fi
}
expect_permission_denied "SELECT postal_code FROM public.listings"
expect_permission_denied "INSERT INTO public.listings(id,user_id) VALUES (3,'33333333-3333-4333-8333-333333333333')"
expect_permission_denied "UPDATE public.listings SET postal_code='00000' WHERE id=2"
expect_permission_denied "DELETE FROM public.listings WHERE id=2"
psql_ci -Atc "SELECT 'ROWS=' || count(*) FROM public.listings" | grep -qx "ROWS=0"
psql_ci -Atc "SELECT 'TEMP_POLICY_ABSENT=' || NOT EXISTS
 (SELECT 1 FROM pg_policies WHERE schemaname='public'
 AND tablename='listings' AND policyname='synthetic_owner_read')" | grep -qx "TEMP_POLICY_ABSENT=true"
echo "PASS_CI_PG17_PRIVACY_RUNTIME: anon CRUD denied; owner CP edit allowed; cross-owner UPDATE blocked; rollback verified"
