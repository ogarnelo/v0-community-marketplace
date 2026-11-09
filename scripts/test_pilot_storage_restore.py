import io
import json
import hashlib
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from contextlib import redirect_stdout

from runpy import run_path

# The production verifier is a command-line file with hyphens in its name,
# not an importable Python module. Load its existing implementation by path.
validate_archive = run_path(
    str(Path(__file__).with_name("verify-pilot-storage-restore.py"))
)["validate_archive"]


def archive_at(path, broken=False, unsafe=False):
    files = {
        "listing-photos/example.webp": b"photo",
        "chat-attachments/example.txt": b"chat",
    }
    manifest = {
        "version": 1,
        "buckets": ["listing-photos", "chat-attachments"],
        "fileCount": 2,
        "totalBytes": 9,
        "files": [
            {
                "bucket": bucket,
                "path": name,
                "size": len(data),
                "sha256": (
                    "0" * 64 if broken and bucket == "listing-photos"
                    else hashlib.sha256(data).hexdigest()
                ),
            }
            for (bucket, name), data in (
                (tuple(p.split("/", 1)), payload) for p, payload in files.items()
            )
        ],
    }
    payloads = dict(files)
    payloads["manifest.json"] = json.dumps(manifest).encode()
    if unsafe:
        payloads["../leaked.txt"] = b"evil"
    with tarfile.open(path, "w:gz") as handle:
        # Match the actual 'tar -czf -C backup/storage-data .' format,
        # which includes root and bucket directories with trailing '/'.
        for name in ("./", "./listing-photos/", "./chat-attachments/"):
            directory = tarfile.TarInfo(name)
            directory.type = tarfile.DIRTYPE
            handle.addfile(directory)
        for name, data in payloads.items():
            info = tarfile.TarInfo("./" + name)
            info.size = len(data)
            handle.addfile(info, io.BytesIO(data))


class RecoveryDrillTest(unittest.TestCase):
    def test_two_buckets_restore_and_verify(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "valid.tar.gz"
            archive_at(archive)
            with redirect_stdout(io.StringIO()) as output:
                validate_archive(archive)
            self.assertIn("2 objects", output.getvalue())

    def test_corrupted_hash_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "tampered.tar.gz"
            archive_at(archive, broken=True)
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                validate_archive(archive)

    def test_duplicate_archive_member_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "duplicate.tar.gz"
            archive_at(archive)
            with tarfile.open(archive, "r:gz") as existing:
                entries = [(member, existing.extractfile(member).read() if member.isfile() else None)
                           for member in existing]
            with tarfile.open(archive, "w:gz") as output:
                for member, payload in entries:
                    output.addfile(member, io.BytesIO(payload) if payload is not None else None)
                extra = tarfile.TarInfo("./listing-photos/example.webp")
                extra.size = len(b"evil")
                output.addfile(extra, io.BytesIO(b"evil"))
            with self.assertRaisesRegex(ValueError, "Duplicate archive member"):
                validate_archive(archive)

    def test_symlink_archive_member_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "symlink.tar.gz"
            archive_at(archive)
            with tarfile.open(archive, "r:gz") as existing:
                entries = [(member, existing.extractfile(member).read() if member.isfile() else None)
                           for member in existing]
            with tarfile.open(archive, "w:gz") as output:
                for member, payload in entries:
                    output.addfile(member, io.BytesIO(payload) if payload is not None else None)
                extra = tarfile.TarInfo("./listing-photos/shortcut")
                extra.type = tarfile.SYMTYPE
                extra.linkname = "../../escape"
                output.addfile(extra)
            with self.assertRaisesRegex(ValueError, "Unsafe archive member type"):
                validate_archive(archive)

    def test_unsafe_member_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "unsafe.tar.gz"
            archive_at(archive, unsafe=True)
            with self.assertRaisesRegex(ValueError, "Path traversal"):
                validate_archive(archive)


if __name__ == "__main__":
    unittest.main()
