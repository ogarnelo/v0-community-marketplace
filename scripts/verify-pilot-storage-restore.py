#!/usr/bin/env python3
"""Safely restore and verify an *already decrypted* Wetudy Storage archive offline.

No Supabase credentials are used. Decrypted files live only in a disposable
private temporary directory on the ephemeral GitHub Actions runner.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tarfile
import tempfile

BUCKETS = {"listing-photos", "chat-attachments"}
MAX_FILES = 10_000
MAX_TOTAL_BYTES = 512 * 1024 * 1024
MAX_MANIFEST_BYTES = 4 * 1024 * 1024
HEX_SHA256 = re.compile(r"^[a-f0-9]{64}$")


def safe_segments(value):
    if not isinstance(value, str) or not value or value.startswith("/"):
        raise ValueError("Invalid archive path")
    if chr(92) in value or chr(0) in value:
        raise ValueError("Forbidden path separator")
    parts = value.split("/")
    if any(p in ("", ".", "..") for p in parts):
        raise ValueError("Path traversal detected")
    return parts


def normalize_tar_name(value):
    # tar -czf -C backup/storage-data . creates './' prefixed names.
    if value == "." or value == "./":
        return None
    if value.startswith("./"):
        value = value[2:]
    return "/".join(safe_segments(value))


def sha256_file(file):
    digest = hashlib.sha256()
    while chunk := file.read(1024 * 1024):
        digest.update(chunk)
    return digest.hexdigest()


def validate_archive(archive_file):
    with tempfile.TemporaryDirectory(prefix="wetudy-offline-restore-") as directory:
        output = Path(directory)
        with tarfile.open(archive_file, mode="r:gz") as archive:
            members = {}
            for member in archive:
                if member.isdir():
                    # The actual tar -czf -C <directory> . archive includes
                    # entries such as "./listing-photos/". Validate the
                    # directory name after removing its trailing slash.
                    directory_name = normalize_tar_name(member.name.rstrip("/"))
                    if directory_name is not None and directory_name.split("/")[0] not in BUCKETS:
                        raise ValueError("Unexpected archive directory")
                    continue
                name = normalize_tar_name(member.name)
                if name is None:
                    continue
                if not member.isfile() or member.issym() or member.islnk():
                    raise ValueError("Unsafe archive member type")
                if name in members:
                    raise ValueError("Duplicate archive member")
                if member.size < 0 or member.size > MAX_TOTAL_BYTES:
                    raise ValueError("Invalid archive file size")
                members[name] = member
                if len(members) > MAX_FILES + 1:
                    raise ValueError("Too many archived files")

            if sum(member.size for member in members.values()) > MAX_TOTAL_BYTES + MAX_MANIFEST_BYTES:\n                raise ValueError("Backup exceeds safety limit before extraction")\n            head = members.pop("manifest.json", None)
            if head is None or head.size > MAX_MANIFEST_BYTES:
                raise ValueError("Missing or oversized backup manifest")
            source = archive.extractfile(head)
            if source is None:
                raise ValueError("Cannot read manifest")
            manifest = json.loads(source.read(MAX_MANIFEST_BYTES + 1))
            if manifest.get("version") != 1 or manifest.get("buckets") is None:
                raise ValueError("Unexpected manifest version")
            if not isinstance(manifest["buckets"], list) or set(manifest["buckets"]) != BUCKETS:
                raise ValueError("Unexpected manifest bucket list")
            files = manifest.get("files")
            if not isinstance(files, list) or not (0 < len(files) <= MAX_FILES):
                raise ValueError("Unexpected manifest object count")
            expected_paths = set()
            total_bytes = 0
            counts = {bucket: 0 for bucket in BUCKETS}
            for item in files:
                if not isinstance(item, dict):
                    raise ValueError("Invalid manifest item")
                bucket = item.get("bucket")
                if bucket not in BUCKETS:
                    raise ValueError("Unexpected bucket")
                segments = safe_segments(item.get("path"))
                filename = bucket + "/" + "/".join(segments)
                if filename in expected_paths:
                    raise ValueError("Duplicate object in manifest")
                expected_paths.add(filename)
                member = members.get(filename)
                expected_size = item.get("size")
                checksum = item.get("sha256")
                if (member is None or type(expected_size) is not int or
                        expected_size < 0 or expected_size != member.size or
                        not isinstance(checksum, str) or not HEX_SHA256.fullmatch(checksum)):
                    raise ValueError("Archive and manifest disagree")
                source = archive.extractfile(member)
                if source is None:
                    raise ValueError("Failed to read backed up object")
                destination = output / bucket / Path(*segments)
                destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                # Do not extract arbitrary tar paths. Write only validated
                # manifest entries into this private scratch directory.
                with destination.open("xb") as restored:
                    while chunk := source.read(1024 * 1024):
                        restored.write(chunk)
                with destination.open("rb") as restored:
                    if sha256_file(restored) != checksum:
                        raise ValueError("Restored file hash mismatch")
                counts[bucket] += 1
                total_bytes += expected_size
                if total_bytes > MAX_TOTAL_BYTES:
                    raise ValueError("Backup exceeds safety limit")
            if set(members) != expected_paths:
                raise ValueError("Archive contains unexpected files or lacks objects")
            if (manifest.get("fileCount") != len(files) or
                    manifest.get("totalBytes") != total_bytes or
                    any(value == 0 for value in counts.values())):
                raise ValueError("Manifest totals mismatch")
            print(
                "Storage offline recovery PASS:",
                len(files), "objects,", total_bytes, "bytes,",
                "listing-photos:", counts["listing-photos"],
                "chat-attachments:", counts["chat-attachments"],
            )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/verify-pilot-storage-restore.py ARCHIVE")
    validate_archive(sys.argv[1])
