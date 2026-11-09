#!/usr/bin/env python3
"""Cold restore of every public APPLICATION table from disposable Supabase CLI.

Do NOT claim a full Supabase/GoTrue recovery. Supabase managed auth/storage schemas
require separate recovery procedures and service configuration, so this exercise
ONLY restores the complete locally authored public schema and rows.
Never connect to remote databases, never overwrite an existing restored DB.
"""
import os
import hashlib
import secrets
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
        for role in ("anon", "authenticated"):
            report[role + "_select_" + name] = sql(
                conn, "SELECT has_table_privilege('" + role + "', 'public."
                + name + "', 'SELECT')::text")
    return report

def verify_restored_rls_reads():
    """Use restored policies with a simulated JWT, not the postgres bypass role."""
    ids = {
        email: sql(SOURCE, "SELECT id FROM auth.users WHERE email='" + email + "'")
        for email in (
            "qa-email-pkce-family@example.invalid",
            "qa-authform-family@example.invalid",
        )
    }
    if len(set(ids.values())) != 2 or any(not value for value in ids.values()):
        raise AssertionError("Expected two distinct local confirmed family accounts")
    first, second = ids.values()
    for own, other in ((first, second), (second, first)):
        query = (
            "BEGIN; SET LOCAL ROLE authenticated; "
            "SELECT set_config('request.jwt.claim.sub','" + own + "',true); "
            "SELECT count(*) FROM public.profiles WHERE id='" + own + "'; "
            "SELECT count(*) FROM public.profiles WHERE id='" + other + "'; "
            "SELECT count(*) FROM public.account_students WHERE owner_user_id='" + own + "'; "
            "SELECT count(*) FROM public.account_students WHERE owner_user_id='" + other + "'; "
            "ROLLBACK;"
        )
        observed = run(
            "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
            "--dbname", DEST, "-c", query).splitlines()
        # SET/BEGIN commands emit textual markers. Inspect numeric SELECT rows.
        numeric = [line for line in observed if line.isdigit()]
        if len(numeric) != 4 or numeric[0:2] != ["1", "0"] or (
                int(numeric[2]) < 1 or numeric[3] != "0"):
            raise AssertionError("Recovered RLS leaks profiles or students across families")
    # A family may not write a student belonging to another user; the target
    # database remains clean even in the unlikely event a policy regresses.
    hostile = (
        "BEGIN; SET LOCAL ROLE authenticated; "
        "SELECT set_config('request.jwt.claim.sub','" + first + "',true); "
        "INSERT INTO public.account_students (owner_user_id,grade_level) "
        "VALUES ('" + second + "','3 Primaria'); ROLLBACK;"
    )
    rejected = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "--dbname", DEST, "-c", hostile],
        capture_output=True, text=True, timeout=25,
    )
    if rejected.returncode == 0 or "row-level security policy" not in rejected.stderr:
        raise AssertionError("Recovered RLS failed to reject hostile student INSERT")
    print("PASS restored RLS runtime: two local families read only own profiles/students, "
          "and cross-family INSERT is denied.")


def seal_and_verify_archive(plain, directory):
    """Encrypt before restore, test wrong-key rejection and ciphertext tampering."""
    password = secrets.token_hex(32)
    env = dict(os.environ, WETUDY_QA_BACKUP_PASSWORD=password)
    encrypted = directory / "public-only.dump.enc"
    restored = directory / "public-only-recovered.dump"
    plain_digest = hashlib.sha256(plain.read_bytes()).hexdigest()
    args = ("openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-iter", "200000")
    def crypto(extra, environment):
        result = subprocess.run([*args[:2], *extra], capture_output=True, text=True,
                                env=environment, timeout=60)
        return result.returncode
    assert crypto(("-aes-256-cbc", "-pbkdf2", "-iter", "200000", "-in",
                   str(plain), "-out", str(encrypted), "-pass",
                   "env:WETUDY_QA_BACKUP_PASSWORD"), env) == 0
    sealed_hash = hashlib.sha256(encrypted.read_bytes()).hexdigest()
    modified = bytearray(encrypted.read_bytes())
    modified[-1] ^= 1
    bad = directory / "tampered-public.dump.enc"
    bad.write_bytes(modified)
    assert hashlib.sha256(bad.read_bytes()).hexdigest() != sealed_hash
    bad.unlink()
    plain.unlink()  # Only encrypted archive exists while awaiting restoration.
    wrong = dict(env, WETUDY_QA_BACKUP_PASSWORD="invalid-wrong-key-qa")
    wrong_path = directory / "wrong-password.dump"
    incorrect = crypto(("-d", "-aes-256-cbc", "-pbkdf2", "-iter", "200000",
                        "-in", str(encrypted), "-out", str(wrong_path), "-pass",
                        "env:WETUDY_QA_BACKUP_PASSWORD"), wrong)
    if incorrect == 0 and wrong_path.exists() and (
            hashlib.sha256(wrong_path.read_bytes()).hexdigest() == plain_digest):
        raise AssertionError("Incorrect password recovered authentic data")
    wrong_path.unlink(missing_ok=True)
    if hashlib.sha256(encrypted.read_bytes()).hexdigest() != sealed_hash:
        raise AssertionError("Encrypted backup integrity check failed")
    assert crypto(("-d", "-aes-256-cbc", "-pbkdf2", "-iter", "200000",
                   "-in", str(encrypted), "-out", str(restored), "-pass",
                   "env:WETUDY_QA_BACKUP_PASSWORD"), env) == 0
    if hashlib.sha256(restored.read_bytes()).hexdigest() != plain_digest:
        raise AssertionError("Recovered archive has incorrect SHA256")
    return restored


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
        archive = seal_and_verify_archive(archive, Path(temp))
        sql(SOURCE, "CREATE DATABASE " + DEST_NAME + " TEMPLATE template0")
        try:
            # The target is a fresh local, empty database. auth.uid() is a
            # minimally scoped compile-time stub for policy DDL; NO real
            # GoTrue or working Auth service is restored by this operation.
            sql(DEST, """CREATE SCHEMA auth;
                CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql
                STABLE AS $qa$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$qa$;""")
            # template0 may already contain an empty public schema.
            sql(DEST, "DROP SCHEMA IF EXISTS public CASCADE")
            # Supabase CLI's postgres login cannot alter DEFAULT PRIVILEGES
            # configured by service administrators. Those govern FUTURE tables;
            # retain and test ACL/GRANT of all EXISTING tables separately.
            toc = run("pg_restore", "--list", str(archive)).splitlines()
            filtered = [line for line in toc if " DEFAULT ACL " not in line]
            removed = len(toc) - len(filtered)
            if removed > 20:
                raise AssertionError("Unexpected number of default-ACL entries")
            toc_path = Path(temp) / "public-restore-toc.list"
            toc_path.write_text("\n".join(filtered) + "\n", encoding="utf8")
            run("pg_restore", "--exit-on-error", "--no-owner",
                "--use-list", str(toc_path),
                "--dbname", DEST, str(archive))
            recovered_names, restored = snapshot(DEST)
            if names != recovered_names or original != restored:
                raise AssertionError("Public application schema/rows differ after cold restore")
            if security_snapshot(DEST) != original_security:
                raise AssertionError("Recovered RLS policies or grants differ")
            # Direct SQL grants and RLS are distinct. If anon has a SELECT
            # grant, it must still see zero private rows via RLS.
            for table in ("profiles", "account_students"):
                if security_snapshot(DEST)["anon_select_" + table] == "t":
                    anonymous_rows = sql(
                        DEST, "SET ROLE anon; SELECT count(*) FROM public."
                        + table).splitlines()[-1]
                    if anonymous_rows != "0":
                        raise AssertionError("Anonymous user can see private " + table)
            verify_restored_rls_reads()
            if sql(DEST, "SELECT count(*) FROM public.user_roles") != "0":
                raise AssertionError("Restored local test center has unexpected admin roles")
            print("PASS ENCRYPTED full LOCAL PUBLIC application schema cold restore: all six "
                  "tables with row digests, RLS and existing-table GRANT parity; no school admin.")
            print("LIMIT: this restores APPLICATION tables only, not Supabase "
                  "managed Auth, GoTrue runtime, SMTP, Storage bytes or hosted DR.")
        finally:
            sql(SOURCE, "DROP DATABASE IF EXISTS " + DEST_NAME + " WITH (FORCE)")

if __name__ == "__main__":
    main()
