#!/usr/bin/env python3
"""Review a five-table anonymous SELECT revoke in a disposable PostgreSQL 17 DB.

No Supabase SDK/network calls. Never accepts a non-loopback, unexpected source DB.
The source is only used to create/drop one uniquely named local test DB.
"""
import os
import subprocess
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

TABLES = ("agreements", "demand_requests", "profiles", "saved_searches", "schools")
CONTROL = ("listings", "school_directory")
SOURCE_DB = "wetudy_pilot_dr_source"
TEST_DB = "wetudy_pilot_anon_select_wave1"
OWNER = "11111111-1111-4111-8111-111111111111"
OTHER = "22222222-2222-4222-8222-222222222222"
SQL_FILE = Path(__file__).resolve().parent / "pilot-anon-select-wave1-local-only.sql"

raw_url = os.environ.get("LOCAL_RESTORE_URL", "")
parts = urlsplit(raw_url)
if (parts.scheme not in ("postgres", "postgresql")
    or parts.hostname not in ("localhost", "127.0.0.1", "::1")
    or parts.path != "/" + SOURCE_DB
    or not parts.username):
    raise SystemExit("Refusing nonlocal/non-disposable PostgreSQL")
test_url = urlunsplit((parts.scheme, parts.netloc, "/" + TEST_DB, "", ""))


def psql(url, *, sql=None, file=None, succeeds=True):
    cmd = ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
           "--dbname", url]
    if (sql is None) == (file is None):
        raise AssertionError("Provide SQL or file, not both")
    cmd += ["-c", sql] if sql is not None else ["-f", str(file)]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
    if (result.returncode == 0) != succeeds:
        raise AssertionError("Unexpected SQL outcome in disposable PostgreSQL: "
                             + result.stderr[-450:])
    return result.stdout.strip(), result.stderr


def query(sql):
    return psql(test_url, sql=sql)[0]


def proposal(*, succeeds=True):
    return psql(test_url, file=SQL_FILE, succeeds=succeeds)


def privilege(role, table, operation):
    return query("select has_table_privilege('"
                 + role + "', 'public." + table + "', '" + operation + "')")


def visible_rows(role, table, actor=OWNER, *, succeeds=True):
    sql = ("set role " + role + "; set app.actor_id = '" + actor
           + "'; select count(*) from public." + table + ";")
    return psql(test_url, sql=sql, succeeds=succeeds)[0]


def check_contract():
    for table in TABLES:
        if privilege("anon", table, "SELECT") != "f":
            raise AssertionError("Anonymous SELECT remained on " + table)
        for role in ("authenticated", "service_role"):
            for operation in ("SELECT", "INSERT", "UPDATE", "DELETE"):
                if privilege(role, table, operation) != "t":
                    raise AssertionError("Authorized client privilege changed")
        for operation in ("INSERT", "UPDATE", "DELETE"):
            if privilege("anon", table, operation) != "t":
                raise AssertionError("Unrelated anonymous grant changed")
        if visible_rows("authenticated", table) != "1":
            raise AssertionError("Authorized owner cannot read own row")
        if visible_rows("authenticated", table, OTHER) != "0":
            raise AssertionError("Unauthorized actor can read another row")
        visible_rows("anon", table, succeeds=False)
        if query("select relrowsecurity from pg_class where oid="
                 "'public." + table + "'::regclass") != "t":
            raise AssertionError("RLS state changed")
    for table in CONTROL:
        if privilege("anon", table, "SELECT") != "f":
            raise AssertionError("Unrelated public table privilege changed")
        if privilege("authenticated", table, "SELECT") != "t":
            raise AssertionError("Unrelated authorized SELECT changed")


if psql(raw_url, sql="select count(*) from pg_database where datname='"
        + TEST_DB + "'")[0] != "0":
    raise SystemExit("Refusing to overwrite existing QA database")
psql(raw_url, sql="create database " + TEST_DB)
try:
    # Roles exist only in the disposable local PostgreSQL service.
    query("""do $$
    begin
      if to_regrole('anon') is null then create role anon nologin; end if;
      if to_regrole('authenticated') is null then
        create role authenticated nologin; end if;
      if to_regrole('service_role') is null then
        create role service_role nologin; end if;
    end $$;""")
    query("grant usage on schema public to anon, authenticated, service_role")
    for table in TABLES + CONTROL:
        query("create table public." + table
              + " (id uuid primary key, owner_id uuid not null, is_active boolean not null)")
        query("alter table public." + table + " enable row level security")
        query("insert into public." + table + " values ('" + OWNER + "', '"
              + OWNER + "', true)")
        query("grant select,insert,update,delete on public." + table
              + " to authenticated, service_role")
        query("create policy test_owner_select on public." + table
              + " for select to authenticated using "
              + "(owner_id = nullif(current_setting('app.actor_id',true),'')::uuid)")
    for table in TABLES:
        query("grant select,insert,update,delete on public." + table + " to anon")
        if privilege("anon", table, "SELECT") != "t":
            raise AssertionError("Missing baseline anonymous grant")
        if visible_rows("anon", table) != "0":
            raise AssertionError("Anonymous RLS baseline must be empty")
    for table in CONTROL:
        if privilege("anon", table, "SELECT") != "f":
            raise AssertionError("Control unexpectedly granted to anon")

    # The SQL file itself must refuse the source database before changing anything.
    _, denied = psql(raw_url, file=SQL_FILE, succeeds=False)
    if "Refusing non-disposable database" not in denied:
        raise AssertionError("Named disposable database guard was not enforced")

    proposal()
    check_contract()
    proposal()  # Idempotence and no alteration of other grants.
    check_contract()

    # Negative test: an inherited PUBLIC table SELECT must fail and roll back.
    query("grant select on public.profiles to public")
    query("grant select on public.agreements to anon")
    _, error = proposal(succeeds=False)
    if "Anonymous SELECT survives" not in error:
        raise AssertionError("PUBLIC inheritance was not rejected")
    if privilege("anon", "agreements", "SELECT") != "t":
        raise AssertionError("Failed proposal unexpectedly committed changes")
    query("revoke select on public.profiles from public")

    # Negative test: a remaining column-specific SELECT must fail closed too.
    query("grant select(owner_id) on public.demand_requests to anon")
    _, error = proposal(succeeds=False)
    if "Anonymous SELECT survives" not in error:
        raise AssertionError("Column-specific SELECT was not rejected")
    if privilege("anon", "agreements", "SELECT") != "t":
        raise AssertionError("Failed column-ACL proposal did not roll back")
    query("revoke select(owner_id) on public.demand_requests from anon")

    # A new anon-visible RLS policy must block this proposal before REVOKE.
    query("create policy test_anon on public.profiles for select to anon using (true)")
    _, error = proposal(succeeds=False)
    if "Anonymous SELECT policy requires manual review" not in error:
        raise AssertionError("Unexpected anon policy did not stop proposal")
    if privilege("anon", "agreements", "SELECT") != "t":
        raise AssertionError("RLS-policy preflight altered privileges")
    query("drop policy test_anon on public.profiles")

    proposal()  # Re-grant on agreements is correctly removed.
    check_contract()
    print("PASS: five anon SELECT grants removed in disposable PG17; "
          "authenticated/service_role and unrelated rights preserved; "
          "RLS ownership, idempotence, rollback, PUBLIC and column grants, "
          "unexpected anon policy, and named-database guard verified.")
finally:
    psql(raw_url, sql="drop database if exists " + TEST_DB + " with (force)")
