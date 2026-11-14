#!/usr/bin/env python3
"""WETUDY: verify previously downloaded, encrypted GitHub Actions ZIP artifacts OFFLINE.

No network, password, decryption, file extraction, database, logs containing names,
or upload. Hash encrypted payloads against signed-by-nobody local SHA256 manifest:
detects corruption, not authenticity or a verified recovery.
"""
import argparse
import hashlib
import re
import stat
import sys
import zipfile
from pathlib import Path

BACKUPS = {
    "database": (
        ("wetudy.dump.enc", "wetudy-acl-snapshot.json.enc"),
        "SHA256SUMS.txt",
    ),
    "storage": (("wetudy-storage.tar.gz.enc",), "STORAGE_SHA256SUMS.txt"),
}
RECORD = re.compile(r"^([0-9a-fA-F]{64})  backup/([A-Za-z0-9_.-]+)$")
MAX_MANIFEST_BYTES = 512
MAX_ENCRYPTED_BYTES = 4 * 1024 * 1024 * 1024


def verify_archive(archive_path: str, kind: str) -> dict:
    if kind not in BACKUPS:
        raise ValueError("Unknown backup type")
    path = Path(archive_path)
    if not path.is_file() or path.is_symlink():
        raise ValueError("Not a regular local ZIP file")
    payload, manifest = BACKUPS[kind]
    expected = set(payload) | {manifest}
    with zipfile.ZipFile(path, "r", allowZip64=True) as archive:
        members = archive.infolist()
        if len(members) != len(expected):
            raise ValueError("Unexpected ZIP member count")
        names = [item.filename for item in members]
        # GitHub artifacts can preserve or flatten a 'backup/' folder.
        if set(names) == expected:
            prefix = ""
        elif set(names) == {"backup/" + name for name in expected}:
            prefix = "backup/"
        else:
            raise ValueError("Missing/extra ZIP member or unsafe ZIP pathname")
        for item in members:
            if item.is_dir() or item.flag_bits & 0x1:
                raise ValueError("Directories and ZIP encryption are not supported")
            mode = (item.external_attr >> 16) & 0xFFFF
            if mode and stat.S_IFMT(mode) not in (0, stat.S_IFREG):
                raise ValueError("ZIP symlinks and special files are forbidden")
            if item.file_size > MAX_ENCRYPTED_BYTES:
                raise ValueError("Encrypted payload exceeds safety limit")
        info = archive.getinfo(prefix + manifest)
        if info.file_size > MAX_MANIFEST_BYTES:
            raise ValueError("Manifest exceeds safety limit")
        with archive.open(info) as stream:
            text = stream.read(MAX_MANIFEST_BYTES + 1).decode("ascii")
        records = text.splitlines()
        if len(records) != len(payload):
            raise ValueError("Unexpected manifest entry count")
        digests = {}
        for record in records:
            match = RECORD.fullmatch(record)
            if not match or match.group(2) not in payload:
                raise ValueError("Malformed or out-of-scope manifest entry")
            name = match.group(2)
            if name in digests:
                raise ValueError("Duplicate manifest entry")
            digests[name] = match.group(1).lower()
        if set(digests) != set(payload):
            raise ValueError("Required encrypted payload missing from manifest")
        total = 0
        for name in payload:
            actual = hashlib.sha256()
            with archive.open(prefix + name) as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b""):
                    total += len(block)
                    if total > MAX_ENCRYPTED_BYTES * len(payload):
                        raise ValueError("Excessive archive payload size")
                    actual.update(block)
            if actual.hexdigest() != digests[name]:
                raise ValueError("Encrypted payload SHA256 does not match manifest")
    return {"kind": kind, "files_verified": len(payload), "encrypted_bytes": total}


def main():
    parser = argparse.ArgumentParser(
        description="Offline integrity check for two existing WETUDY encrypted GitHub ZIP artifacts."
    )
    parser.add_argument("--db", required=True, help="Path to encrypted PostgreSQL artifact ZIP")
    parser.add_argument("--storage", required=True, help="Path to encrypted Storage artifact ZIP")
    args = parser.parse_args()
    try:
        results = [
            verify_archive(args.db, "database"),
            verify_archive(args.storage, "storage"),
        ]
        for result in results:
            print("PASS {}: {} encrypted file(s), {} bytes hashed".format(
                result["kind"], result["files_verified"], result["encrypted_bytes"]
            ))
        print("INTEGRITY OK: encrypted ZIP copies matched their included manifests.")
        print("NOT VERIFIED: backup authenticity, decryption, completeness or full disaster recovery.")
    except (OSError, ValueError, UnicodeError, zipfile.BadZipFile, RuntimeError) as exc:
        # Do not print local filenames or content in support tickets / copied logs.
        print("NO-GO: offline backup ZIP integrity check failed (" +
              type(exc).__name__ + ")", file=sys.stderr)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
