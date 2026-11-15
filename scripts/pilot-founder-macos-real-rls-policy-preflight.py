#!/usr/bin/env python3
"""Read-only macOS offline inspection of two REAL archived public RLS policies.

Verifies encrypted DB ZIP; decrypts into chmod-0700 private tempdir, extracts
ONLY policy DDL to temp files, reports metadata flags. No SQL execution, DB
connection, production credentials, real rows or retained plaintext.
"""
import argparse
import getpass
import re
import runpy
import subprocess
import sys
import tempfile
from pathlib import Path
import zipfile

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
PREFLIGHT = runpy.run_path(str(HERE / "pilot-founder-local-backup-preflight.py"))
DECRYPT = runpy.run_path(str(HERE / "pilot-founder-macos-offline-drill.py"))["decrypt_from_zip"]
CHECK_PG = runpy.run_path(str(HERE / "pilot-founder-macos-pg17-toc.py"))["check_pg_restore"]
POLICIES = frozenset(("saved_search_matches_select_own", "saved_search_matches_delete_own"))
TABLE = "saved_search_matches"
LIMIT = 12 * 1024 * 1024


def select_policies(toc):
    chosen = {}
    for line in toc.splitlines():
        m = re.fullmatch(
            r"\s*\d+;\s+\d+\s+\d+\s+POLICY\s+public\s+"
            + TABLE + r"\s+(saved_search_matches_(?:select|delete)_own)"
            + r"(?:\s+.*)?",
            line,
        )
        if m:
            if m.group(1) in chosen:
                raise ValueError("Duplicate target policy")
            chosen[m.group(1)] = line
    if set(chosen) != POLICIES:
        raise ValueError("Exactly two target policies not in TOC")
    return "\n".join(chosen[name] for name in sorted(POLICIES)) + "\n"


def inspect_ddl(sql):
    # Only counts allowlisted CREATE POLICY commands. SQL never printed/sent.
    found = set()
    for name in POLICIES:
        pattern = (r"\bCREATE\s+POLICY\s+\"?" + re.escape(name)
                   + r"\"?\s+ON\s+(?:public\.)?\"?" + TABLE + r"\"?\b")
        occurrences = re.findall(pattern, sql, re.IGNORECASE)
        if len(occurrences) != 1:
            raise ValueError("Expected exactly one CREATE POLICY for each archived policy")
        found.add(name)
    if re.search(r"\b(?:COPY|INSERT|UPDATE|DELETE)\s+(?:INTO|FROM)\s+(?:public\.)?"
                 + TABLE + r"\b", sql, re.IGNORECASE):
        raise ValueError("Unexpected table-data DML in policy-only output")
    return {
        "real_archived_policies_selected": len(found),
        "target_table": TABLE,
        "policy_ddl_rendered": True,
        "only_policies_selected": True,
        "sql_executed": False,
        "production_modified": False,
        "database_modified": False,
        "real_data_restored": False,
    }


def run(db_zip, storage_zip, password, pg_restore):
    PREFLIGHT["run"](db_zip, storage_zip)
    binary = CHECK_PG(pg_restore)
    if not password:
        raise ValueError("Empty passphrase")
    with tempfile.TemporaryDirectory(prefix="wetudy-policy-ddl-private-") as directory:
        root = Path(directory)
        root.chmod(0o700)
        dump = root / "postgres.dump"
        selected = root / "two-policies.toc"
        ddl = root / "two-policies.sql"
        DECRYPT(db_zip, "wetudy.dump.enc", password, dump)
        with dump.open("rb") as f:
            if f.read(5) != b"PGDMP":
                raise ValueError("Invalid PostgreSQL custom dump")
        toc = subprocess.run(
            [binary, "--list", str(dump)],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            env={"PATH": "/usr/bin:/bin:/usr/sbin:/sbin"}, timeout=180,
            check=False,
        )
        if toc.returncode or not toc.stdout or len(toc.stdout) > LIMIT:
            raise ValueError("Unreadable PostgreSQL TOC")
        selected.write_text(select_policies(toc.stdout.decode("utf-8","replace")))
        selected.chmod(0o600)
        # No --dbname and no shell. pg_restore writes only a temporary SQL file.
        render = subprocess.run(
            [binary, "--schema-only", "--no-owner", "--no-acl",
             "--use-list", str(selected), "--file", str(ddl), str(dump)],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            env={"PATH": "/usr/bin:/bin:/usr/sbin:/sbin"}, timeout=180,
            check=False,
        )
        if render.returncode or not ddl.is_file() or ddl.stat().st_size > LIMIT:
            raise ValueError("Failed to render archived RLS policy DDL")
        return inspect_ddl(ddl.read_text(encoding="utf-8", errors="replace"))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--database-zip", required=True)
    ap.add_argument("--storage-zip", required=True)
    ap.add_argument("--pg-restore", default="/Applications/Postgres.app/Contents/Versions/17/bin/pg_restore")
    ap.add_argument("--confirm-local-policy-inspection", action="store_true")
    args = ap.parse_args()
    if not args.confirm_local_policy_inspection:
        ap.error("Explicit --confirm-local-policy-inspection required")
    try:
        secret = getpass.getpass("Local encryption password (not shared): ")
        result = run(args.database_zip, args.storage_zip, secret, args.pg_restore)
    except (OSError, ValueError, RuntimeError, UnicodeError, zipfile.BadZipFile,
            subprocess.TimeoutExpired) as exc:
        print("NO_GO_MAC_REAL_RLS_POLICY_PREFLIGHT: " + type(exc).__name__, file=sys.stderr)
        return 2
    finally:
        if "secret" in locals():
            secret = None
    print("PASS_MAC_REAL_RLS_POLICY_PREFLIGHT")
    for key, value in result.items():
        print(f"{key}: {value}")
    print("NOT_CERTIFIED: RLS replay/enforcement, database restore, ACL, Auth runtime, Storage API")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
