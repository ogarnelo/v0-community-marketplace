#!/usr/bin/env python3
"""WETUDY Mac Intel: read-only pg_restore 17 TOC inspection of encrypted ZIP.

Never restores or connects to a database. Prints aggregate, non-PII findings
only. Scratch decrypted dump is automatically deleted on exit.
"""
import argparse
import getpass
from pathlib import Path
import re
import runpy
import subprocess
import sys
import tempfile
import zipfile

HERE = Path(__file__).resolve().parent
PREFLIGHT = runpy.run_path(str(HERE / "pilot-founder-local-backup-preflight.py"))
DECRYPT = runpy.run_path(str(HERE / "pilot-founder-macos-offline-drill.py"))["decrypt_from_zip"]
CRITICAL = runpy.run_path(str(HERE / "pilot-db-backup-critical-toc.py"))
MANAGED = runpy.run_path(str(HERE / "pilot-managed-schema-toc-coverage.py"))
MAX_TOC_BYTES = 12 * 1024 * 1024


def check_pg_restore(binary):
    executable = Path(binary)
    if not executable.is_file():
        raise ValueError("Missing PostgreSQL restore binary")
    check = subprocess.run(
        [str(executable), "--version"],
        stdin=subprocess.DEVNULL, capture_output=True, timeout=20, check=False)
    if check.returncode != 0 or not re.fullmatch(
        rb"pg_restore \(PostgreSQL\) 17\.\d+(?: \([^)]+\))?\s*", check.stdout
    ):
        raise ValueError("Expected a PostgreSQL 17 pg_restore executable")
    return str(executable)


def assess_toc(toc):
    critical = CRITICAL["assess"](toc)
    managed = MANAGED["assess"](toc)["schemas"]
    entries = CRITICAL["parse_toc"](toc)
    return {
        "toc_readable": True,
        "public_critical_complete": critical["critical_public_toc_ready"],
        "public_79_tables_complete": critical["all_public_toc_ready"],
        "auth_users_data_present": ("auth", "users", "TABLE DATA") in entries,
        "auth_identities_data_present": ("auth", "identities", "TABLE DATA") in entries,
        "storage_objects_data_present": ("storage", "objects", "TABLE DATA") in entries,
        "auth_toc_pairs": managed["auth"]["toc_table_and_data_pairs"],
        "auth_tables_expected": managed["auth"]["catalog_tables_expected"],
        "storage_toc_pairs": managed["storage"]["toc_table_and_data_pairs"],
        "storage_tables_expected": managed["storage"]["catalog_tables_expected"],
        "full_database_restored": False,
        "auth_runtime_verified": False,
        "production_modified": False,
    }


def run(db_zip, storage_zip, password, binary):
    # Re-check both encrypted archives before opening any ciphertext.
    PREFLIGHT["run"](db_zip, storage_zip)
    pg_restore = check_pg_restore(binary)
    if not password:
        raise ValueError("Empty passphrase")
    with tempfile.TemporaryDirectory(prefix="wetudy-mac-toc-private-") as directory:
        root = Path(directory)
        root.chmod(0o700)
        dump = root / "postgres.dump"
        DECRYPT(db_zip, "wetudy.dump.enc", password, dump)
        with dump.open("rb") as stream:
            if stream.read(5) != b"PGDMP":
                raise ValueError("Not a PostgreSQL custom dump")
        result = subprocess.run(
            [pg_restore, "--list", str(dump)],
            stdin=subprocess.DEVNULL, capture_output=True, timeout=180,
            check=False, env={"PATH": "/usr/bin:/bin:/usr/sbin:/sbin"},
        )
        if result.returncode != 0 or not result.stdout or len(result.stdout) > MAX_TOC_BYTES:
            raise ValueError("PostgreSQL TOC inspection failed")
        toc = result.stdout.decode("utf-8", errors="replace")
        return assess_toc(toc)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-zip", required=True)
    parser.add_argument("--storage-zip", required=True)
    parser.add_argument(
        "--pg-restore",
        default="/Applications/Postgres.app/Contents/Versions/17/bin/pg_restore",
    )
    parser.add_argument("--confirm-local-toc", action="store_true")
    args = parser.parse_args()
    if not args.confirm_local_toc:
        parser.error("--confirm-local-toc required; no database restore is performed")
    try:
        # No input password on command line, no secrets in logs.
        password = getpass.getpass("Local encryption password (not shared): ")
        finding = run(args.database_zip, args.storage_zip, password, args.pg_restore)
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile,
            subprocess.TimeoutExpired, UnicodeError) as exc:
        print("NO_GO_MAC_PG17_TOC: " + type(exc).__name__, file=sys.stderr)
        return 2
    finally:
        if "password" in locals():
            password = None
    print("PASS_MAC_PG17_TOC: PostgreSQL 17 successfully read decrypted dump catalog")
    for key, value in finding.items():
        print(key + ": " + str(value))
    if not (finding["auth_users_data_present"] and finding["auth_identities_data_present"]):
        print("NO_GO_AUTH_TOC: Auth users/identities TABLE DATA not both present")
    if not finding["public_79_tables_complete"]:
        print("NO_GO_PUBLIC_TOC: public schema coverage incomplete")
    print("NOT_CERTIFIED: DB data restore, ACL replay, Auth/GoTrue runtime, Storage API, RTO/RPO")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
