#!/usr/bin/env python3
"""WETUDY Mac: selective REAL archived RLS replay against synthetic rows only.

NO real data is restored. One local transaction and unconditional ROLLBACK.
Rejects unknown policy predicates, nonlocal destinations, wrong role, and nonempty
target. Never writes plaintext backup or passwords outside private scratch.
"""
import argparse
import getpass
import os
from pathlib import Path
import re
import runpy
import subprocess
import sys
import tempfile
import zipfile

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
PREFLIGHT = runpy.run_path(str(HERE / "pilot-founder-local-backup-preflight.py"))
DECRYPT = runpy.run_path(str(HERE / "pilot-founder-macos-offline-drill.py"))["decrypt_from_zip"]
POLICY = runpy.run_path(str(HERE / "pilot-founder-macos-real-rls-policy-preflight.py"))
CHECK_PG = POLICY["CHECK_PG"]
SELECT_TOC = POLICY["select_policies"]
MAX_SQL = 256 * 1024
DB = "wetudy_dr_local_20261115"
USER = "wetudy_dr_restore"
PG_HOME = Path("/Applications/Postgres.app/Contents/Versions/17/bin")
ID_A = "11111111-1111-4111-8111-111111111111"
ID_B = "22222222-2222-4222-8222-222222222222"
EXPECTED = {
    "saved_search_matches_select_own": "SELECT",
    "saved_search_matches_delete_own": "DELETE",
}

def extract_strict_policy_statements(archive_sql):
    """Never replay free-form archive SQL: allow two narrowly reviewed policies.

    Only SELECT and DELETE, only role authenticated, only predicate user_id =
    auth.uid(), possibly with nested parentheses and SELECT wrapper.
    Reject SQL containing extra clauses, function calls, operators or comments
    in the selected statements. SQL outside statements is never executed.
    """
    statements = re.findall(
        r"\bCREATE\s+POLICY\s+[\s\S]*?;", archive_sql, re.IGNORECASE)
    if len(statements) != 2:
        raise ValueError("Expected exactly two CREATE POLICY statements")
    vetted = {}
    for sql in statements:
        match = re.fullmatch(
            r"\s*CREATE\s+POLICY\s+\"?(saved_search_matches_(?:select|delete)_own)\"?"
            r"\s+ON\s+(?:\"?public\"?\.)?\"?saved_search_matches\"?"
            r"\s+(?:AS\s+PERMISSIVE\s+)?FOR\s+(SELECT|DELETE)"
            r"\s+TO\s+\"?authenticated\"?\s+USING\s*(\([\s\S]*\))\s*;\s*",
            sql, flags=re.IGNORECASE,
        )
        if not match:
            raise ValueError("Archived policy statement differs from safe allowlist")
        name, command, expression = match.groups()
        if EXPECTED.get(name) != command.upper() or name in vetted:
            raise ValueError("Wrong or duplicate archived policy")
        # No comments, string literals, semicolons, casts or non-allowlisted funcs.
        if not re.fullmatch(r"[\s()=A-Za-z_.]*", expression):
            raise ValueError("Unsafe policy expression")
        simple = re.sub(r"[\s()]", "", expression).lower()
        simple = simple.replace("selectauth.uid", "auth.uid")
        if simple not in ("user_id=auth.uid", "auth.uid=user_id"):
            raise ValueError("Archived policy predicate requires separate review")
        vetted[name] = sql.strip()
    if set(vetted) != set(EXPECTED):
        raise ValueError("Missing archived policy")
    return "\n".join(vetted[n] for n in sorted(vetted)) + "\n"

def safe_env(password):
    return {"PATH": "/usr/bin:/bin:/usr/sbin:/sbin",
            "PGPASSWORD": password,
            "PGCONNECT_TIMEOUT": "5",
            "PGOPTIONS": "-c statement_timeout=15000 -c lock_timeout=3000"}

def run_psql(binary, password, source_sql, *, timeout=90):
    result = subprocess.run(
        [str(binary), "-X", "-w", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
         "-h", "127.0.0.1", "-p", "5432", "-U", USER, "-d", DB],
        input=source_sql, text=True, capture_output=True,
        env=safe_env(password), timeout=timeout, check=False)
    if result.returncode:
        raise ValueError("Local PostgreSQL operation failed; rollback on connection close")
    return {line.strip() for line in result.stdout.splitlines() if line.strip()}

def gate_local_target(psql, password):
    info = run_psql(psql, password, """
SELECT 'database=' || current_database();
SELECT 'user=' || current_user;
SELECT 'superuser=' || rolsuper FROM pg_roles WHERE rolname=current_user;
SELECT 'server_addr=' || inet_server_addr();
SELECT 'listen=' || current_setting('listen_addresses');
SELECT 'can_set_authenticated=' || pg_has_role(current_user,'authenticated','SET');
SELECT 'auth_role_no_login=' || NOT rolcanlogin FROM pg_roles WHERE rolname='authenticated';
SELECT 'tables=' || count(*) FROM pg_tables
 WHERE schemaname NOT IN ('pg_catalog','information_schema');
SELECT 'auth_schema_absent=' || (to_regnamespace('auth') IS NULL);
SELECT 'target_table_absent=' || (to_regclass('public.saved_search_matches') IS NULL);
""")
    expected = {
        "database=" + DB, "user=" + USER, "superuser=false",
        "server_addr=127.0.0.1", "listen=localhost",
        "can_set_authenticated=true", "auth_role_no_login=true",
        "tables=0", "auth_schema_absent=true", "target_table_absent=true",
    }
    if not expected.issubset(info):
        raise ValueError("Local empty sandbox, network or privileges gate failed")

def synthetic_transaction(policy_sql):
    # NO COMMIT. psql runs the entire string in one session.
    # Failures cause connection close/automatic rollback.
    return r"""
BEGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.saved_search_matches (id bigint PRIMARY KEY, user_id uuid NOT NULL);
INSERT INTO public.saved_search_matches VALUES
(1,'""" + ID_A + r"""'),(2,'""" + ID_B + r"""');
ALTER TABLE public.saved_search_matches ENABLE ROW LEVEL SECURITY;
GRANT SELECT, DELETE ON public.saved_search_matches TO authenticated;
""" + policy_sql + r"""
SELECT 'POLICIES_PRESENT=' || count(*)
 FROM pg_policies
 WHERE schemaname='public' AND tablename='saved_search_matches'
   AND policyname IN ('saved_search_matches_select_own','saved_search_matches_delete_own')
   AND roles='{authenticated}';
SET LOCAL ROLE authenticated;
SELECT 'NO_JWT_VISIBLE=' || count(*) FROM public.saved_search_matches;
WITH d AS (DELETE FROM public.saved_search_matches RETURNING id)
SELECT 'NO_JWT_DELETE_BLOCKED=' || (count(*)=0) FROM d;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE authenticated;
SELECT 'EMPTY_JWT_VISIBLE=' || count(*) FROM public.saved_search_matches;
WITH d AS (DELETE FROM public.saved_search_matches RETURNING id)
SELECT 'EMPTY_JWT_DELETE_BLOCKED=' || (count(*)=0) FROM d;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','""" + ID_A + r"""',true);
SET LOCAL ROLE authenticated;
SELECT 'A_VISIBLE=' || count(*) FROM public.saved_search_matches;
SELECT 'A_OTHER_INVISIBLE=' || NOT EXISTS
 (SELECT 1 FROM public.saved_search_matches WHERE id=2);
WITH d AS (DELETE FROM public.saved_search_matches WHERE id=2 RETURNING id)
SELECT 'A_CROSS_DELETE_BLOCKED=' || (count(*)=0) FROM d;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','""" + ID_B + r"""',true);
SET LOCAL ROLE authenticated;
SELECT 'B_VISIBLE=' || count(*) FROM public.saved_search_matches;
WITH d AS (DELETE FROM public.saved_search_matches WHERE id=1 RETURNING id)
SELECT 'B_CROSS_DELETE_BLOCKED=' || (count(*)=0) FROM d;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','""" + ID_A + r"""',true);
SET LOCAL ROLE authenticated;
WITH d AS (DELETE FROM public.saved_search_matches WHERE id=1 RETURNING id)
SELECT 'A_OWN_DELETE_ALLOWED=' || (count(*)=1) FROM d;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','""" + ID_B + r"""',true);
SET LOCAL ROLE authenticated;
WITH d AS (DELETE FROM public.saved_search_matches WHERE id=2 RETURNING id)
SELECT 'B_OWN_DELETE_ALLOWED=' || (count(*)=1) FROM d;
RESET ROLE;
ROLLBACK;
SELECT 'ROLLBACK_TABLE_ABSENT=' ||
 (to_regclass('public.saved_search_matches') IS NULL);
SELECT 'ROLLBACK_AUTH_ABSENT=' || (to_regnamespace('auth') IS NULL);
"""

EXPECTED_RESULTS = {
    "POLICIES_PRESENT=2", "NO_JWT_VISIBLE=0", "NO_JWT_DELETE_BLOCKED=true", "A_VISIBLE=1", "A_OTHER_INVISIBLE=true",
    "A_CROSS_DELETE_BLOCKED=true", "A_OWN_DELETE_ALLOWED=true",
    "B_VISIBLE=1", "B_CROSS_DELETE_BLOCKED=true", "B_OWN_DELETE_ALLOWED=true",
    "EMPTY_JWT_VISIBLE=0", "EMPTY_JWT_DELETE_BLOCKED=true",
    "ROLLBACK_TABLE_ABSENT=true", "ROLLBACK_AUTH_ABSENT=true",
}

def run(db_zip, storage_zip, backup_password, local_password):
    PREFLIGHT["run"](db_zip, storage_zip)
    pg_restore = CHECK_PG(PG_HOME / "pg_restore")
    psql = PG_HOME / "psql"
    if not psql.is_file() or not backup_password or not local_password:
        raise ValueError("Missing local prerequisites")
    gate_local_target(psql, local_password)
    with tempfile.TemporaryDirectory(prefix="wetudy-archived-rls-private-") as td:
        root = Path(td)
        root.chmod(0o700)
        dump = root / "archive.dump"
        selected = root / "selected.toc"
        ddl = root / "policy.sql"
        DECRYPT(db_zip, "wetudy.dump.enc", backup_password, dump)
        with dump.open("rb") as stream:
            if stream.read(5) != b"PGDMP":
                raise ValueError("Invalid PGDMP")
        toc = subprocess.run([pg_restore, "--list", str(dump)],
            stdin=subprocess.DEVNULL, capture_output=True, timeout=180,
            env={"PATH": "/usr/bin:/bin:/usr/sbin:/sbin"})
        if toc.returncode or not toc.stdout or len(toc.stdout)>POLICY["LIMIT"]:
            raise ValueError("Missing archive TOC")
        selected.write_text(SELECT_TOC(toc.stdout.decode("utf-8","replace")))
        selected.chmod(0o600)
        render = subprocess.run([pg_restore, "--schema-only", "--no-owner",
                    "--no-acl", "--use-list", str(selected), "--file", str(ddl), str(dump)],
            stdin=subprocess.DEVNULL, capture_output=True, timeout=180,
            env={"PATH": "/usr/bin:/bin:/usr/sbin:/sbin"})
        if render.returncode or not ddl.is_file() or ddl.stat().st_size>MAX_SQL:
            raise ValueError("Unable to extract safe RLS definitions")
        archived = extract_strict_policy_statements(ddl.read_text(errors="replace"))
        # Confirm exact target is still empty immediately before running.
        gate_local_target(psql, local_password)
        output = run_psql(psql, local_password, synthetic_transaction(archived))
        if not EXPECTED_RESULTS.issubset(output):
            raise ValueError("Archived RLS isolation checks failed")
        gate_local_target(psql, local_password)
    return {"real_archived_rls_policies_executed":2,
            "synthetic_family_isolation":True,
            "synthetic_both_owner_deletes":True,
            "synthetic_missing_jwt_denied":True,
            "rollback_verified":True,
            "real_backup_rows_restored":False,
            "production_modified":False,
            "full_disaster_recovery_certified":False}

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--database-zip", required=True)
    ap.add_argument("--storage-zip", required=True)
    ap.add_argument("--confirm-replay-local-synthetic-only", action="store_true")
    args=ap.parse_args()
    if not args.confirm_replay_local_synthetic_only:
        ap.error("Explicit --confirm-replay-local-synthetic-only required")
    try:
        local_password=getpass.getpass("LOCAL PostgreSQL restore role password (not shared): ")
        backup_password=getpass.getpass("BACKUP encryption password (not shared): ")
        result=run(args.database_zip,args.storage_zip,backup_password,local_password)
    except (OSError,ValueError,RuntimeError,UnicodeError,
            subprocess.TimeoutExpired,zipfile.BadZipFile) as exc:
        print("NO_GO_MAC_ARCHIVED_RLS_REPLAY: "+type(exc).__name__,file=sys.stderr)
        return 2
    finally:
        if "local_password" in locals():local_password=None
        if "backup_password" in locals():backup_password=None
    print("PASS_MAC_ARCHIVED_RLS_REPLAY")
    for k,v in result.items(): print(k+": "+str(v))
    print("NOT_CERTIFIED: DB/Auth/Storage full restore, ACL replay, GoTrue, Storage API, RTO/RPO")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
