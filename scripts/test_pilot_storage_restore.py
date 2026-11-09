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

    def test_total_byte_limit_rejects_before_writing_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "oversized.tar.gz"
            archive_at(archive)  # fixture contains 9 bytes in two objects
            globals_ = validate_archive.__globals__
            original = globals_["MAX_TOTAL_BYTES"]
            try:
                globals_["MAX_TOTAL_BYTES"] = 8
                with self.assertRaisesRegex(ValueError, "Invalid archive file size|before extraction"):
                    validate_archive(archive)
            finally:
                globals_["MAX_TOTAL_BYTES"] = original

    def test_invalid_manifest_bucket_type_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "bad-manifest.tar.gz"
            archive_at(archive)
            with tarfile.open(archive, "r:gz") as source:
                contents = [(m, source.extractfile(m).read() if m.isfile() else None)
                            for m in source]
            with tarfile.open(archive, "w:gz") as output:
                for member, payload in contents:
                    if member.name == "./manifest.json":
                        manifest = json.loads(payload)
                        manifest["buckets"] = "listing-photos"
                        payload = json.dumps(manifest).encode()
                        member.size = len(payload)
                    output.addfile(member, io.BytesIO(payload) if payload is not None else None)
            with self.assertRaisesRegex(ValueError, "Unexpected manifest bucket list"):
                validate_archive(archive)

    def test_non_object_manifest_fails_cleanly(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "list-manifest.tar.gz"
            archive_at(archive)
            self._replace_manifest(archive, lambda _manifest: [])
            with self.assertRaisesRegex(ValueError, "Invalid backup manifest structure"):
                validate_archive(archive)

    def test_duplicate_bucket_names_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "duplicate-buckets.tar.gz"
            archive_at(archive)
            self._replace_manifest(
                archive,
                lambda manifest: dict(manifest, buckets=[
                    "listing-photos", "chat-attachments", "listing-photos"]))
            with self.assertRaisesRegex(ValueError, "Unexpected manifest bucket list"):
                validate_archive(archive)

    def test_wrong_manifest_totals_rejected_preflight(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "wrong-total.tar.gz"
            archive_at(archive)
            self._replace_manifest(archive, lambda manifest: dict(manifest, totalBytes=10))
            with self.assertRaisesRegex(ValueError, "Manifest totals mismatch"):
                validate_archive(archive)

    def test_missing_manifest_object_rejected_preflight(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "missing-object.tar.gz"
            archive_at(archive)
            self._replace_manifest(
                archive,
                lambda manifest: dict(manifest,
                    files=manifest["files"][:-1], fileCount=1, totalBytes=5))
            with self.assertRaisesRegex(ValueError, "Archive contains unexpected files"):
                validate_archive(archive)

    @staticmethod
    def _replace_manifest(archive, transform):
        with tarfile.open(archive, "r:gz") as source:
            entries = [(member, source.extractfile(member).read()
                        if member.isfile() else None) for member in source]
        with tarfile.open(archive, "w:gz") as output:
            for member, payload in entries:
                if member.name == "./manifest.json":
                    payload = json.dumps(transform(json.loads(payload))).encode()
                    member.size = len(payload)
                output.addfile(member, io.BytesIO(payload)
                               if payload is not None else None)

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

    def test_hardlink_archive_member_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "hardlink.tar.gz"
            archive_at(archive)
            with tarfile.open(archive, "r:gz") as existing:
                entries = [(m, existing.extractfile(m).read() if m.isfile() else None)
                           for m in existing]
            with tarfile.open(archive, "w:gz") as output:
                for member, payload in entries:
                    output.addfile(member, io.BytesIO(payload) if payload is not None else None)
                link = tarfile.TarInfo("./chat-attachments/hardlink")
                link.type = tarfile.LNKTYPE
                link.linkname = "./listing-photos/example.webp"
                output.addfile(link)
            with self.assertRaisesRegex(ValueError, "Unsafe archive member type"):
                validate_archive(archive)

    def test_unexpected_bucket_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "extra-bucket.tar.gz"
            archive_at(archive)
            with tarfile.open(archive, "r:gz") as existing:
                entries = [(m, existing.extractfile(m).read() if m.isfile() else None)
                           for m in existing]
            with tarfile.open(archive, "w:gz") as output:
                for member, payload in entries:
                    output.addfile(member, io.BytesIO(payload) if payload is not None else None)
                extra = tarfile.TarInfo("./unknown-bucket/secret.txt")
                extra.size = 6
                output.addfile(extra, io.BytesIO(b"secret"))
            with self.assertRaisesRegex(ValueError, "unexpected files"):
                validate_archive(archive)

    def test_missing_manifest_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "no-manifest.tar.gz"
            with tarfile.open(archive, "w:gz") as output:
                info = tarfile.TarInfo("./listing-photos/image.webp")
                info.size = 3
                output.addfile(info, io.BytesIO(b"img"))
            with self.assertRaisesRegex(ValueError, "Missing or oversized backup manifest"):
                validate_archive(archive)

    def test_unsafe_member_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "unsafe.tar.gz"
            archive_at(archive, unsafe=True)
            with self.assertRaisesRegex(ValueError, "Path traversal"):
                validate_archive(archive)


if __name__ == "__main__":
    unittest.main()
