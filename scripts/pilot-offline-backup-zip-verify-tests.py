#!/usr/bin/env python3
"""Synthetic-only offline regression. Never reads genuine backups."""
import hashlib
import os
import stat
import tempfile
import unittest
import zipfile
from pathlib import Path
import importlib.util

spec = importlib.util.spec_from_file_location("wetudy_offline",
    Path(__file__).parent / "pilot-offline-backup-zip-verify.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def build(path, kind, prefix="", tamper=False, extra=False, missing=False,
          symlink=False, duplicate=False):
    names, manifest = mod.BACKUPS[kind]
    blobs = {name: ("synthetic encrypted: " + name).encode() for name in names}
    if tamper:
        first = names[0]
        blobs[first] = b"TAMPER" + blobs[first]
    hashes = {name: hashlib.sha256(("synthetic encrypted: " + name).encode()).hexdigest()
              for name in names}
    text = "".join("{}  backup/{}\n".format(hashes[name],name) for name in names)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, payload in blobs.items():
            if missing and name == names[0]:
                continue
            archive.writestr(prefix + name, payload)
        if duplicate:
            text += "{}  backup/{}\n".format(hashes[names[0]],names[0])
        archive.writestr(prefix + manifest, text)
        if extra:
            archive.writestr("../untrusted.txt", b"evil")
        if symlink:
            link=zipfile.ZipInfo(prefix + "evil")
            link.create_system=3
            link.external_attr=(stat.S_IFLNK | 0o777) << 16
            archive.writestr(link, b"/etc/passwd")


class Verify(unittest.TestCase):
    def setUp(self):
        self.t=tempfile.TemporaryDirectory()
        self.addCleanup(self.t.cleanup)
        self.dir=Path(self.t.name)
    def p(self,name):
        return self.dir / name
    def test_database_root(self):
        p=self.p("db.zip")
        build(p,"database")
        self.assertEqual(mod.verify_archive(str(p),"database")["files_verified"],2)
    def test_storage_backup_prefix(self):
        p=self.p("storage.zip")
        build(p,"storage",prefix="backup/")
        self.assertEqual(mod.verify_archive(str(p),"storage")["files_verified"],1)
    def test_tampering_rejected(self):
        p=self.p("tampered.zip")
        build(p,"database",tamper=True)
        with self.assertRaises(ValueError): mod.verify_archive(str(p),"database")
    def test_unknown_zip_member_rejected(self):
        p=self.p("extra.zip")
        build(p,"storage",extra=True)
        with self.assertRaises(ValueError): mod.verify_archive(str(p),"storage")
    def test_missing_required_file_rejected(self):
        p=self.p("missing.zip")
        build(p,"database",missing=True)
        with self.assertRaises(ValueError): mod.verify_archive(str(p),"database")
    def test_duplicate_manifest_rejected(self):
        p=self.p("duplicate.zip")
        build(p,"database",duplicate=True)
        with self.assertRaises(ValueError): mod.verify_archive(str(p),"database")
    def test_zip_symlink_rejected(self):
        p=self.p("symlink.zip")
        build(p,"database",symlink=True)
        with self.assertRaises(ValueError): mod.verify_archive(str(p),"database")
    def test_wrong_type_rejected(self):
        p=self.p("wrong-type.zip")
        build(p,"storage")
        with self.assertRaises(ValueError): mod.verify_archive(str(p),"database")
    def test_symlink_input_rejected(self):
        p=self.p("db.zip")
        build(p,"database")
        alias=self.p("alias.zip")
        os.symlink(p,alias)
        with self.assertRaises(ValueError): mod.verify_archive(str(alias),"database")


if __name__=="__main__":
    unittest.main()
