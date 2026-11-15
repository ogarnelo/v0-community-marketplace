#!/usr/bin/env python3
"""Guard the founder's local recovery tool against regressions and secret leaks."""
import io
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch
from contextlib import redirect_stdout

HERE=Path(__file__).resolve().parent
SCRIPT=HERE/"pilot-founder-local-drill.py"


class LocalDrillContracts(unittest.TestCase):
    def test_source_never_contacts_production_or_prints_password(self):
        source=SCRIPT.read_text(encoding="utf8")
        self.assertIn('"--network","none"',source)
        self.assertIn('getpass.getpass(',source)
        self.assertIn('TemporaryDirectory(',source)
        self.assertIn('"--confirm-decrypt-locally"',source)
        self.assertIn('STORAGE["validate_archive"]',source)
        self.assertIn('"pg_restore","--list"',source)
        self.assertNotIn("supabase.co",source)
        self.assertNotIn("stripe.com",source)
        self.assertNotIn("print(password",source)
        self.assertNotIn("shell=True",source)
        self.assertNotIn("pg_restore --dbname",source)

    def test_doctor_does_not_decrypt_or_require_backup_files(self):
        ns=runpy.run_path(str(SCRIPT))
        with patch.object(ns["doctor"].__globals__["shutil"],"which",side_effect=lambda exe:"/usr/bin/"+exe):
            with patch.object(ns["doctor"].__globals__["subprocess"],"run") as runner:
                runner.return_value.returncode=0
                with redirect_stdout(io.StringIO()) as out:
                    result=ns["doctor"]()
                self.assertTrue(result)
                self.assertIn("DOCKER_ENGINE: READY",out.getvalue())
                self.assertIn("--format",runner.call_args.args[0])

    def test_manifest_and_encrypted_bytes_are_processed_locally_only(self):
        src=SCRIPT.read_text()
        self.assertIn('PREFLIGHT["run"](db_zip,storage_zip)',src)
        self.assertIn('decrypt(db_enc,db_dump,password)',src)
        self.assertIn('decrypt(storage_enc,storage_tar,password)',src)
        self.assertIn('"type=bind,source={private},target=/private,readonly"',src)
        self.assertIn('"auth_users_data_toc"',src)
        self.assertIn('"auth_identities_data_toc"',src)
        self.assertIn('NOT_CERTIFIED:',src)


if __name__=="__main__":
    unittest.main()
