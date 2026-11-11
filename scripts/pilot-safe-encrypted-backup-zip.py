#!/usr/bin/env python3
"""Extract only the expected encrypted PostgreSQL backup artifact files.

Do not trust ZIP paths, links, duplicate names, or unexpected members.
Never opens PostgreSQL, contacts GitHub, reads unencrypted records or secrets.
"""
from pathlib import Path
import stat
import sys
import zipfile

REQUIRED = {"wetudy.dump.enc", "SHA256SUMS.txt"}
OPTIONAL = {"wetudy-acl-snapshot.json.enc"}
MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024
MAX_MEMBER_BYTES = 2 * 1024 * 1024 * 1024


def safe_extract(source, dest):
    target = Path(dest)
    if target.exists() and any(target.iterdir()):
        raise ValueError("Refusing to overwrite existing extracted backup")
    with zipfile.ZipFile(source) as archive:
        files = {}
        total = 0
        for member in archive.infolist():
            name = member.filename
            if member.is_dir():
                # Artifact uploads may retain the root directory.
                if name not in ("backup/",):
                    raise ValueError("Unexpected ZIP directory")
                continue
            if name.startswith("backup/"):
                name = name[len("backup/"):]
            if name not in REQUIRED | OPTIONAL or name in files:
                raise ValueError("Unexpected or duplicate backup ZIP member")
            unix_mode = (member.external_attr >> 16) & 0xFFFF
            if stat.S_IFMT(unix_mode) not in (0, stat.S_IFREG):
                raise ValueError("ZIP symbolic link or special member denied")
            if member.file_size <= 0 or member.file_size > MAX_MEMBER_BYTES:
                raise ValueError("Invalid encrypted backup file size")
            total += member.file_size
            if total > MAX_TOTAL_BYTES:
                raise ValueError("Backup ZIP uncompressed size exceeds limit")
            files[name] = member
        if not REQUIRED.issubset(files):
            raise ValueError("Missing required encrypted backup artifact files")
        target.mkdir(mode=0o700, parents=True, exist_ok=True)
        for name, member in files.items():
            # Explicitly bounded stream copy; no extract/extractall.
            written = 0
            with archive.open(member) as stream, (target / name).open("xb") as output:
                while chunk := stream.read(1024 * 1024):
                    written += len(chunk)
                    if written > member.file_size:
                        raise ValueError("ZIP member exceeded declared size")
                    output.write(chunk)
            if written != member.file_size:
                raise ValueError("ZIP member length mismatch")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 3:
            raise ValueError("Usage: pilot-safe-encrypted-backup-zip.py ARCHIVE.zip OUTPUT_DIR")
        safe_extract(sys.argv[1], sys.argv[2])
        print("PASS: encrypted backup ZIP members validated and extracted")
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        print("BLOCKED: encrypted backup ZIP unsafe: " + str(error), file=sys.stderr)
        raise SystemExit(2)
