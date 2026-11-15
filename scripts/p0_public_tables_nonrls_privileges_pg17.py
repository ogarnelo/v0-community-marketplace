#!/usr/bin/env python3
"""Local PostgreSQL17-only proof for the REVIEW ONLY 48-table ACL hardening.

No connection to production is permitted. Tests rollback, scope and invariants.
"""
import os
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

root = Path(__file__).resolve().parents[1]
migration = root / "scripts/p0_public_tables_nonrls_privileges_review_only.sql"
sql = migration.read_text()
match = re.search(r"ON TABLE\n(.*?)\nFROM anon, authenticated;", sql, re.S)
if not match:
    raise AssertionError("Expected explicit atomic SQL table list")
tables = re.findall(r"public\.([a-z_]+)", match.group(1))
if len(tables) != 48 or len(set(tables)) != 48 or "listings" in tables:
    raise AssertionError("Reviewed production ACL inventory drift")

url = os.environ.get("LOCAL_RESTORE_URL", "")
u = urlsplit(url)
if (u.scheme not in ("postgres","postgresql") or
    u.hostname not in ("localhost", "127.0.0.1", "::1") or
    u.path != "/wetudy_pilot_dr_source"):
    raise SystemExit("P0 ACL fixture refuses non-local or non-disposable DB")

fixture = "wetudy_p0_nonrls_48_fixture"
base = url
target = urlunsplit((u.scheme, u.netloc, "/" + fixture, "", ""))
def psql(db, statement=None, file=None, ok=True):
    command = ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "--dbname",db]
    if file:
        command += ["-f", str(file)]
    else:
        command += ["-c",statement]
    x = subprocess.run(command, capture_output=True, text=True, timeout=55)
    if (x.returncode == 0) != ok:
        raise AssertionError("Unexpected PostgreSQL fixture result: " +
                             (x.stderr[-1200:] if x.stderr else x.stdout[-1200:]))
    return x.stdout.strip() if ok else x.stderr.strip()

if psql(base, "SELECT count(*) FROM pg_database WHERE datname='"+fixture+"'") != "0":
    raise SystemExit("Refusing to overwrite existing ACL database")
psql(base, "CREATE DATABASE "+fixture)
try:
    psql(target, """DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')
      THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated')
      THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role')
      THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$""")
    for name in tables:
        psql(target, "CREATE TABLE public."+name+" (id bigint PRIMARY KEY)")
        psql(target, "ALTER TABLE public."+name+" ENABLE ROW LEVEL SECURITY")
        psql(target,"GRANT ALL ON public."+name+" TO anon,authenticated,service_role")
    psql(target,"CREATE TABLE public.listings (id uuid PRIMARY KEY, postal_code text)")
    psql(target,"ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY")
    psql(target,"GRANT ALL ON public.listings TO service_role")
    psql(target,"GRANT SELECT,INSERT,UPDATE,DELETE ON public.listings TO authenticated")
    # This fixture starts with post-PR528/first-remediation listings role grants.
    psql(target,"REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON public.listings FROM authenticated")
    for i in range(30):
        name = "wetudy_fixture_%02d" % i
        psql(target,"CREATE TABLE public."+name+" (id bigint PRIMARY KEY)")
        psql(target,"ALTER TABLE public."+name+" ENABLE ROW LEVEL SECURITY")
    if psql(target,"SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p')") != "79":
        raise AssertionError("Fixture must have exactly 79 public tables")
    psql(target,file=migration)
    psql(target,file=migration)  # Safe to apply twice if the allowlist is unchanged.
    for name in tables:
        for role in ("anon","authenticated"):
            for privilege in ("TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"):
                if psql(target,"SELECT has_table_privilege('"+role+"','public."+name+"','"+privilege+"')")!="f":
                    raise AssertionError("Non-RLS grant remains")
            for privilege in ("SELECT","INSERT","UPDATE","DELETE"):
                if psql(target,"SELECT has_table_privilege('"+role+"','public."+name+"','"+privilege+"')")!="t":
                    raise AssertionError("Ordinary grant was unexpectedly removed")
    # Simulate an *unlisted* table grant. Preflight fails with a specific reason.
    psql(target,"GRANT TRUNCATE ON public.wetudy_fixture_00 TO anon")
    msg=psql(target,file=migration,ok=False)
    if "NO_GO_PUBLIC_ACL: unexpected table grants" not in msg:
        raise AssertionError("Unexpected-table grant did not fail preflight")
    if psql(target,"SELECT has_table_privilege('anon','public.wetudy_fixture_00','TRUNCATE')")!="t":
        raise AssertionError("Negative test failed to preserve original ACL")
    psql(target,"REVOKE TRUNCATE ON public.wetudy_fixture_00 FROM anon")
    psql(target,"ALTER TABLE public.wetudy_fixture_00 DISABLE ROW LEVEL SECURITY")
    msg=psql(target,file=migration,ok=False)
    if "NO_GO_PUBLIC_ACL: some public tables lack RLS" not in msg:
        raise AssertionError("RLS-off drift not rejected")
    psql(target,"ALTER TABLE public.wetudy_fixture_00 ENABLE ROW LEVEL SECURITY")
    psql(target,"CREATE TABLE public.wetudy_new_unreviewed_table (id bigint)")
    msg=psql(target,file=migration,ok=False)
    if "NO_GO_PUBLIC_ACL: expected 79 public tables" not in msg:
        raise AssertionError("Schema drift not rejected")
    print("PASS PG17: 48-table non-RLS privileges revoked with 79-table fixed scope; "
          "ordinary DML intact; idempotence and 3 negative preflight cases")
finally:
    psql(base,"DROP DATABASE IF EXISTS "+fixture+" WITH (FORCE)")
