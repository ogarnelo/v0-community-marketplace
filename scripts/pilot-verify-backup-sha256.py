#!/usr/bin/env python3
"""Verify an encrypted PostgreSQL backup using a strict SHA-256 manifest.

Only exact, whitelisted files under the extracted backup directory are read.
Never follows manifest-provided paths, executes external processes or connects
to a database. Rejects missing/duplicate/extra/malformed checksum records.
"""
import hashlib
from pathlib import Path
import re
import sys

REQUIRED = {"wetudy.dump.enc"}
OPTIONAL = {"wetudy-acl-snapshot.json.enc"}
PATTERN = re.compile(r"^([0-9a-fA-F]{64})  backup/(wetudy\\.dump\\.enc|wetudy-acl-snapshot\\.json\\.enc)$")


def verify(directory):
    root = Path(directory)
    manifest = root / "SHA256SUMS.txt"
    if not root.is_dir() or root.is_symlink() or not manifest.is_file() or manifest.is_symlink():
        raise ValueError("Missing regular encrypted-backup directory or manifest")
    lines = manifest.read_text(encoding="ascii").splitlines()
    if not 1 <= len(lines) <= 2:
        raise ValueError("Unexpected SHA-256 manifest entry count")
    expected = {}
    for line in lines:
        match = PATTERN.fullmatch(line)
        if not match:
            raise ValueError("Malformed or out-of-scope SHA-256 manifest record")
        digest, name = match.groups()
        if name in expected:
            raise ValueError("Duplicate encrypted backup checksum record")
        expected[name] = digest.lower()
    if not REQUIRED.issubset(expected):
        raise ValueError("Required encrypted dump checksum missing")
    files = {p.name for p in root.iterdir()}
    if files != set(expected) | {"SHA256SUMS.txt"}:
        raise ValueError("Manifest does not exactly match extracted backup files")
    for name, digest in expected.items():
        file = root / name
        if not file.is_file() or file.is_symlink():
            raise ValueError("Encrypted backup must be a regular file")
        actual = hashlib.sha256()
        with file.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                actual.update(chunk)
        if actual.hexdigest() != digest:
            raise ValueError("Encrypted backup SHA-256 mismatch")
    return sorted(expected)


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("Usage: pilot-verify-backup-sha256.py EXTRACTED_BACKUP_DIR")
        verified = verify(sys.argv[1])
        print("PASS: strict SHA-256 encrypted backup verification (" + str(len(verified)) + " files)")
    except (OSError, ValueError, UnicodeError) as error:
        print("BLOCKED: encrypted-backup manifest: " + str(error), file=sys.stderr)
        raise SystemExit(2)
