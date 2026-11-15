"""Synthetic-only checks for pg_restore 17 TOC parser and privacy."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import subprocess
SRC=Path(__file__).with_name("pilot-founder-macos-pg17-toc.py")
spec=importlib.util.spec_from_file_location("wetudy_local_toc",SRC)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def entry(n,kind,schema,table):
    return f"{n}; 1259 1234 {kind} {schema} {table} postgres\n"

class LocalTOCTests(unittest.TestCase):
    def test_pg17_version_accepts_mac_and_rejects_unsupported(self):
        with patch.object(mod.Path,"is_file",return_value=True):
            with patch.object(mod.subprocess,"run",return_value=subprocess.CompletedProcess([],0,b"pg_restore (PostgreSQL) 17.12 (Postgres.app)\n",b"")):
                self.assertEqual(mod.check_pg_restore("/Applications/test/pg_restore"),"/Applications/test/pg_restore")
            with patch.object(mod.subprocess,"run",return_value=subprocess.CompletedProcess([],0,b"pg_restore (PostgreSQL) 16.0\n",b"")):
                with self.assertRaisesRegex(ValueError,"PostgreSQL 17"):
                    mod.check_pg_restore("/Applications/test/pg_restore")

    def test_absent_auth_sections_are_fail_closed_not_certified(self):
        text=entry(1,"TABLE","public","listings")+entry(2,"TABLE DATA","public","listings")
        x=mod.assess_toc(text)
        self.assertFalse(x["auth_users_data_present"])
        self.assertFalse(x["auth_identities_data_present"])
        self.assertFalse(x["public_79_tables_complete"])
        self.assertFalse(x["full_database_restored"])
        self.assertFalse(x["auth_runtime_verified"])
        self.assertFalse(x["production_modified"])

    def test_auth_toc_sections_are_detected_not_reported_restored(self):
        text="".join(entry(i+1,kind,schema,table)
             for i,(kind,schema,table) in enumerate([
              ("TABLE","auth","users"),("TABLE DATA","auth","users"),
              ("TABLE","auth","identities"),("TABLE DATA","auth","identities"),
              ("TABLE","storage","objects"),("TABLE DATA","storage","objects")]))
        x=mod.assess_toc(text)
        self.assertTrue(x["auth_users_data_present"])
        self.assertTrue(x["auth_identities_data_present"])
        self.assertTrue(x["storage_objects_data_present"])
        self.assertEqual(x["auth_toc_pairs"],2)
        self.assertFalse(x["full_database_restored"])

    def test_source_limits_pii_logging_and_has_no_db_connections(self):
        source=SRC.read_text()
        self.assertIn('"--list"',source)
        self.assertIn('TemporaryDirectory(',source)
        self.assertIn('getpass.getpass(',source)
        self.assertIn('capture_output=True',source)
        self.assertIn('MAX_TOC_BYTES',source)
        self.assertIn('NOT_CERTIFIED:',source)
        for forbidden in ("--dbname", "--file=", "shell=True", "supabase.co",
                          "print(toc)", "print(password)", "print(result.stdout)"):
            self.assertNotIn(forbidden,source)

if __name__=="__main__":
    unittest.main()
