#!/usr/bin/env python3
"""Cold restore of every public APPLICATION table from disposable Supabase CLI.

Do NOT claim a full Supabase/GoTrue recovery. Supabase managed auth/storage schemas
require separate recovery procedures and service configuration, so this exercise
ONLY restores the complete locally authored public schema and rows.
Never connect to remote databases, never overwrite an existing restored DB.
"""
import os
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import urlsplit, urlunsplit

SOURCE = os.getenv("LOCAL_DB_URL", "")
parsed = urlsplit(SOURCE)
if (parsed.scheme not in ("postgres", "postgresql") or
        parsed.hostname not in ("localhost", "127.0.0.1", "::1") or
        parsed.path != "/postgres"):
    raise SystemExit("Refusing nonlocal application-schema restore source")
DEST_NAME = "wetudy_qa_public_restore_only"
DEST = urlunsplit((parsed.scheme, parsed.netloc, "/" + DEST_NAME, "", ""))

TABLES = (
    "profiles", "growth_acquisition_events", "account_students",
    "schools", "school_directory", "user_roles",
)

def run(*argv):
    result = subprocess.run(argv, text=True, capture_output=True,
                            check=False, timeout=120)
    if result.returncode:
        # No SQL rows, database URLs, password hashes or connection strings
        # in CI logs, even when a subprocess fails.
        reasons = [line.strip() for line in result.stderr.splitlines()
                   if "ERROR:" in line or "pg_restore: error:" in line]
        raise RuntimeError(argv[0] + " failed: " +
                           " | ".join(reasons[:2])[:450])
    return result.stdout.strip()

def sql(conn, statement):
    return run("psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
               "--dbname", conn, "-c", statement)

def snapshot(conn):
    # Compare every JSONB column and row for ALL user-authored public tables,
    # not just sample rows or counts. Aggregates return only checksums.
    digests = {}
    for table in TABLES:
        digests[table] = sql(
            conn, "SELECT count(*)::text || ':' || "
            "coalesce(md5(string_agg(row_payload, ',' ORDER BY row_payload)), md5('')) "
            "FROM (SELECT to_jsonb(t)::text AS row_payload FROM public."
            + table + " AS t) AS payloads")
    names = sql(conn, "SELECT string_agg(tablename, ',' ORDER BY tablename) "
                "FROM pg_tables WHERE schemaname = 'public'")
    return names, digests

def security_snapshot(conn):
    report = {}
    for name in TABLES:
        report[name] = sql(
            conn, "SELECT relrowsecurity::text || ':' || "
            "coalesce((SELECT string_agg(polname || ':' || polcmd::text, ',' ORDER BY polname) "
            "FROM pg_policy WHERE polrelid=c.oid), '') "
            "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
            "WHERE n.nspname='public' AND c.relname='" + name + "'"
        )
    for name in ("profiles", "account_students", "user_roles", "school_directory"):
        report["authenticated_select_" + name] = sql(
            conn, "SELECT has_table_privilege('authenticated', 'public."
            + name + "', 'SELECT')::text")
    return report

def main():
    names, original = snapshot(SOURCE)
    original_security = security_snapshot(SOURCE)
    if set(names.split(",")) != set(TABLES):
        raise AssertionError("Unexpected local public schema: check table inventory")
    if any(not checksum or checksum.startswith("0:") for name, checksum
           in original.items() if name not in ("user_roles",)):
        raise AssertionError("Expected synthetic application data is missing")
    if sql(SOURCE, "SELECT count(*) FROM pg_database WHERE datname='" +
           DEST_NAME + "'") != "0":
        raise RuntimeError("Refusing to overwrite existing local recovery database")
    with tempfile.TemporaryDirectory(prefix="wetudy-qa-public-restore-") as temp:
        archive = Path(temp) / "public-only.dump"
        run("pg_dump", "--format=custom", "--schema=public", "--no-owner",
            "--dbname", SOURCE, "--file", str(archive))
        if archive.stat().st_size < 4096:
            raise AssertionError("Empty public-schema dump")
        sql(SOURCE, "CREATE DATABASE " + DEST_NAME + " TEMPLATE template0")
        try:
            # The target is a fresh local, empty database. auth.uid() is a
            # minimally scoped compile-time stub for policy DDL; NO real
            # GoTrue or working Auth service is restored by this operation.
            sql(DEST, """CREATE SCHEMA auth;
                CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql
                STABLE AS $SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$;""")
            # template0 may already contain an empty public schema.
            sql(DEST, "DROP SCHEMA IF EXISTS public CASCADE")
            run("pg_restore", "--exit-on-error", "--no-owner",
                "--dbname", DEST, str(archive))
            recovered_names, restored = snapshot(DEST)
            if names != recovered_names or original != restored:
                raise AssertionError("Public application schema/rows differ after cold restore")
            if security_snapshot(DEST) != original_security:
                raise AssertionError("Recovered RLS policies or grants differ")
            if sql(DEST, "SELECT has_table_privilege('anon', 'public.profiles', 'SELECT')") != "f":
                raise AssertionError("Anonymous access to profiles was granted")
            if sql(DEST, "SELECT count(*) FROM public.user_roles") != "0":
                raise AssertionError("Restored local test center has unexpected admin roles")
            print("PASS full LOCAL PUBLIC application schema cold restore: all six "
                  "tables with row digests, RLS and SQL GRANT parity; no school admin.")
            print("LIMIT: this restores APPLICATION tables only, not Supabase "
                  "managed Auth, GoTrue runtime, SMTP, Storage bytes or hosted DR.")
        finally:
            sql(SOURCE, "DROP DATABASE IF EXISTS " + DEST_NAME + " WITH (FORCE)")

if __name__ == "__main__":
    main()
