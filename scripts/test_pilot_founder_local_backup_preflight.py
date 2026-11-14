#!/usr/bin/env python3
"""Synthetic, credential-free tests for the founder's offline encrypted ZIP check."""
import hashlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import zipfile

SCRIPT=Path(__file__).with_name("pilot-founder-local-backup-preflight.py")
spec=importlib.util.spec_from_file_location("founder_preflight",SCRIPT)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def fixture(path, kind, *, tamper=False, extra=None, missing_acl=False):
    if kind=="database":
        names=["wetudy.dump.enc"] + ([] if missing_acl else ["wetudy-acl-snapshot.json.enc"])
        manifest="SHA256SUMS.txt"
    else:
        names=["wetudy-storage.tar.gz.enc"]
        manifest="STORAGE_SHA256SUMS.txt"
    data={name:b"Salted__"+b"12345678"+b"fake-encrypted-synthetic" for name in names}
    digests=[hashlib.sha256(v).hexdigest()+"  backup/"+name for name,v in data.items()]
    if tamper:
        data[names[0]]+=b"tampering"
    data[manifest]="\n".join(digests).encode("ascii")+b"\n"
    if extra:
        data.update(extra)
    with zipfile.ZipFile(path,"w",compression=zipfile.ZIP_STORED) as z:
        for name, value in data.items():
            z.writestr(name,value)


class FounderPreflightTests(unittest.TestCase):
    def test_both_encrypted_archives_verified_without_decryption(self):
        with tempfile.TemporaryDirectory() as t:
            db=Path(t)/"db.zip"; st=Path(t)/"storage.zip"
            fixture(db,"database");fixture(st,"storage")
            result=mod.run(db,st)
            self.assertEqual(result["database"]["encrypted_files_verified"],2)
            self.assertEqual(result["storage"]["encrypted_files_verified"],1)
            self.assertTrue(result["database"]["acl_snapshot_included"])
            self.assertFalse(result["decrypted"])
            self.assertFalse(result["production_touched"])

    def test_legacy_database_without_acl_is_not_misrepresented(self):
        with tempfile.TemporaryDirectory() as t:
            db=Path(t)/"db.zip"
            fixture(db,"database",missing_acl=True)
            self.assertFalse(mod.inspect_zip(db,"database")["acl_snapshot_included"])

    def test_corrupted_ciphertext_is_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/"db.zip"; fixture(p,"database",tamper=True)
            with self.assertRaisesRegex(mod.BackupBlocked,"SHA256 mismatch"):
                mod.inspect_zip(p,"database")

    def test_traversal_and_unexpected_files_are_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/"storage.zip"
            fixture(p,"storage",extra={"../../private.txt":b"bad"})
            with self.assertRaisesRegex(mod.BackupBlocked,"Unexpected"):
                mod.inspect_zip(p,"storage")

    def test_duplicate_members_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/"storage.zip";fixture(p,"storage")
            with zipfile.ZipFile(p,"a") as z:
                z.writestr("wetudy-storage.tar.gz.enc",b"Salty")
            with self.assertRaisesRegex(mod.BackupBlocked,"duplicate"):
                mod.inspect_zip(p,"storage")

    def test_plaintext_not_accepted_as_encrypted(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/"storage.zip";fixture(p,"storage")
            with zipfile.ZipFile(p,"w") as z:
                data=b"not-encrypted"
                z.writestr("wetudy-storage.tar.gz.enc",data)
                z.writestr("STORAGE_SHA256SUMS.txt",
                    hashlib.sha256(data).hexdigest().encode()+
                    b"  backup/wetudy-storage.tar.gz.enc\n")
            with self.assertRaisesRegex(mod.BackupBlocked,"OpenSSL header"):
                mod.inspect_zip(p,"storage")


if __name__=="__main__":
    unittest.main()
