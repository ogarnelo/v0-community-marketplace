#!/usr/bin/env python3
"""WETUDY local founder backup preflight. Offline, no decryption or secrets.

Usage: python3 scripts/pilot-founder-local-backup-preflight.py
       --database-zip "/private/path/db.zip" --storage-zip "/private/path/storage.zip"
Does NOT connect to Supabase, GitHub, Docker or any database. Do not upload backups.
"""
import argparse
import hashlib
import re
import stat
import sys
import zipfile
from pathlib import Path

DB_REQUIRED = frozenset(("wetudy.dump.enc", "SHA256SUMS.txt"))
DB_OPTIONAL = frozenset(("wetudy-acl-snapshot.json.enc",))
ST_REQUIRED = frozenset(("wetudy-storage.tar.gz.enc", "STORAGE_SHA256SUMS.txt"))
MAX_ZIP_MEMBER = 2 * 1024**3
MAX_ZIP_TOTAL = 2 * 1024**3 + 16 * 1024**2
MAX_CHECKSUM = 4096
MAX_RATIO = 100
CHECKSUM_PATTERN = re.compile(
    r"^([0-9a-fA-F]{64})  backup/([a-zA-Z0-9_.-]+)$"
)


class BackupBlocked(ValueError):
    pass


def _stream_digest(source):
    digest = hashlib.sha256()
    first = b""
    while True:
        part = source.read(1024 * 1024)
        if not part:
            break
        if len(first) < 16:
            first += part[:16 - len(first)]
        digest.update(part)
    return digest.hexdigest(), first


def inspect_zip(zip_path, kind):
    required, optional, manifest_name = (
        (DB_REQUIRED, DB_OPTIONAL, "SHA256SUMS.txt")
        if kind == "database"
        else (ST_REQUIRED, frozenset(), "STORAGE_SHA256SUMS.txt")
    )
    permitted = required | optional
    archive_path = Path(zip_path).expanduser()
    if not archive_path.is_file() or archive_path.is_symlink():
        raise BackupBlocked("Backup ZIP is not a regular file")
    with zipfile.ZipFile(archive_path) as archive:
        entries = {}
        total = 0
        for member in archive.infolist():
            name = member.filename
            if member.is_dir():
                if name != "backup/":
                    raise BackupBlocked("Unexpected ZIP directory")
                continue
            normalized = name[7:] if name.startswith("backup/") else name
            if normalized not in permitted or normalized in entries:
                raise BackupBlocked("Unexpected or duplicate ZIP member")
            mode = (member.external_attr >> 16) & 0xffff
            if stat.S_IFMT(mode) not in (0, stat.S_IFREG):
                raise BackupBlocked("ZIP symlink or special file")
            if member.file_size <= 0 or member.file_size > MAX_ZIP_MEMBER:
                raise BackupBlocked("Invalid ZIP member size")
            if member.compress_size <= 0 or member.file_size > MAX_RATIO * member.compress_size:
                raise BackupBlocked("Unsafe ZIP expansion")
            total += member.file_size
            if total > MAX_ZIP_TOTAL:
                raise BackupBlocked("ZIP exceeds allowed size")
            entries[normalized] = member
        if not required.issubset(entries):
            raise BackupBlocked("Required encrypted backup files are missing")
        header = entries[manifest_name]
        if header.file_size > MAX_CHECKSUM:
            raise BackupBlocked("Checksum manifest too large")
        with archive.open(header) as src:
            try:
                lines = src.read(MAX_CHECKSUM + 1).decode("ascii").splitlines()
            except UnicodeError as err:
                raise BackupBlocked("Invalid checksum manifest encoding") from err
        expected = {}
        for line in lines:
            match = CHECKSUM_PATTERN.fullmatch(line)
            if not match:
                raise BackupBlocked("Invalid checksum manifest entry")
            digest, filename = match.groups()
            if filename in expected or filename not in permitted or filename == manifest_name:
                raise BackupBlocked("Duplicate or unexpected checksum")
            expected[filename] = digest.lower()
        encrypted = set(entries) - {manifest_name}
        if set(expected) != encrypted:
            raise BackupBlocked("Encrypted files and checksum entries differ")
        result = {}
        for name in sorted(encrypted):
            with archive.open(entries[name]) as src:
                actual, magic = _stream_digest(src)
            if actual != expected[name]:
                raise BackupBlocked("Encrypted file SHA256 mismatch")
            if not magic.startswith(b"Salted__"):
                raise BackupBlocked("Encrypted file has unexpected OpenSSL header")
            result[name] = entries[name].file_size
        return {"encrypted_files_verified": len(result),
                "encrypted_bytes": sum(result.values()),
                "acl_snapshot_included": "wetudy-acl-snapshot.json.enc" in result
                if kind == "database" else None}


def run(db_zip, storage_zip):
    database = inspect_zip(db_zip, "database")
    storage = inspect_zip(storage_zip, "storage")
    return {"database": database, "storage": storage,
            "decrypted": False, "restored": False, "auth_verified": False,
            "production_touched": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-zip", required=True, help="Local encrypted PostgreSQL ZIP")
    parser.add_argument("--storage-zip", required=True, help="Local encrypted Storage ZIP")
    args = parser.parse_args()
    try:
        result = run(args.database_zip, args.storage_zip)
    except (OSError, ValueError, zipfile.BadZipFile, RuntimeError) as exc:
        # Never log local backup paths, filenames, or private records.
        print("NO_GO_BACKUP_PREFLIGHT: " + exc.__class__.__name__, file=sys.stderr)
        return 2
    print("PASS_BACKUP_PREFLIGHT: DB verified", result["database"]["encrypted_files_verified"],
          "encrypted file(s); Storage verified",
          result["storage"]["encrypted_files_verified"], "encrypted file(s).")
    print("ACL_ENVELOPE_PRESENT:", result["database"]["acl_snapshot_included"])
    print("NOT_VERIFIED: decryption, full database restore, Auth, Storage bytes, RTO/RPO.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
