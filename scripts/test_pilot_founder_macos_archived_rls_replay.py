"""Synthetic-only tests: real backup never appears in CI."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
SRC=Path(__file__).with_name("pilot-founder-macos-archived-rls-replay.py")
spec=importlib.util.spec_from_file_location("mac_archived_rls",SRC)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def policies(select_using="(user_id = auth.uid())",delete_using="(auth.uid() = user_id)"):
    return ("-- archive header\n"
      "CREATE POLICY saved_search_matches_select_own ON public.saved_search_matches "
      "AS PERMISSIVE FOR SELECT TO authenticated USING "+select_using+";\n"
      "CREATE POLICY saved_search_matches_delete_own ON public.saved_search_matches "
      "FOR DELETE TO authenticated USING "+delete_using+";\n")

class ArchivedRLSReplayTests(unittest.TestCase):
    def test_two_real_sql_statements_vetted(self):
        sql=mod.extract_strict_policy_statements(policies())
        self.assertEqual(sql.count("CREATE POLICY"),2)
        self.assertNotIn("archive header",sql)
        self.assertIn("TO authenticated",sql)

    def test_select_auth_uid_wrapper_and_quoted_identifiers(self):
        sql=policies("((user_id = ( SELECT auth.uid() )))",
                     "((auth.uid() = user_id))")
        self.assertEqual(mod.extract_strict_policy_statements(sql).count("CREATE POLICY"),2)

    def test_refuse_unsafe_alternate_predicate(self):
        for change in ("(true)", "(auth.uid() IS NOT NULL)", "(user_id = evil.uid())",
                       "(user_id = auth.uid() OR true)", "(user_id = auth.uid()::uuid)"):
            with self.subTest(change=change):
                with self.assertRaises(ValueError):
                    mod.extract_strict_policy_statements(policies(change))

    def test_refuse_wrong_role_wrong_command_and_additional_policy(self):
        for change in (
          policies().replace("TO authenticated","TO PUBLIC",1),
          policies().replace("FOR DELETE","FOR UPDATE"),
          policies()+"CREATE POLICY other ON public.saved_search_matches FOR SELECT TO authenticated USING (true);"):
            with self.assertRaises(ValueError):
                mod.extract_strict_policy_statements(change)

    def test_no_jwt_really_tested_before_deletes(self):
        text=mod.synthetic_transaction(mod.extract_strict_policy_statements(policies()))
        no_jwt=text.index("NO_JWT_VISIBLE")
        empty_jwt=text.index("EMPTY_JWT_VISIBLE")
        delete_owner=text.index("A_OWN_DELETE_ALLOWED")
        self.assertLess(no_jwt,delete_owner)
        self.assertLess(empty_jwt,delete_owner)
        self.assertIn("ROLLBACK;",text)
        self.assertNotIn("COMMIT;",text)
        self.assertEqual(len(mod.EXPECTED_RESULTS),14)

    def test_min_privileges_local_only_and_no_archived_rows(self):
        source=SRC.read_text()
        for expected in ('"127.0.0.1"', '"5432"', 'wetudy_dr_local_20261115',
                         'wetudy_dr_restore', 'getpass.getpass(', 'TemporaryDirectory(',
                         "extract_strict_policy_statements", 'ROLLBACK;',
                         'tables=0', 'superuser=false', 'auth_role_no_login=true'):
            self.assertIn(expected,source)
        for excluded in ('--dbname', 'shell=True', 'print(archived)',
                         "pg_restore, '--dbname'", 'CREATE DATABASE',
                         'DROP DATABASE', 'DROP ROLE', 'pg_reload_conf()'):
            self.assertNotIn(excluded,source)

if __name__ == "__main__":
    unittest.main()
