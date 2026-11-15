"""Synthetic metadata tests; no database, credentials or private user rows."""
import importlib.util
from pathlib import Path
import unittest
SRC=Path(__file__).with_name("pilot-founder-macos-real-rls-policy-preflight.py")
sp=importlib.util.spec_from_file_location("rls_preflight",SRC)
mod=importlib.util.module_from_spec(sp)
sp.loader.exec_module(mod)

def item(index,policy):
    return f"{index}; 3256 44251 POLICY public saved_search_matches {policy} postgres\n"

class PolicyPreflightTests(unittest.TestCase):
    def test_select_only_two_exact_real_policy_names(self):
        toc="# synthetic\n"+item(4,"saved_search_matches_select_own")+item(5,"saved_search_matches_delete_own")+item(6,"something_else")
        selected=mod.select_policies(toc)
        self.assertEqual(len(selected.splitlines()),2)
        self.assertNotIn("something_else",selected)

    def test_missing_and_duplicate_rejected(self):
        with self.assertRaises(ValueError):
            mod.select_policies(item(1,"saved_search_matches_select_own"))
        with self.assertRaises(ValueError):
            mod.select_policies(item(1,"saved_search_matches_select_own")+item(2,"saved_search_matches_select_own")+item(3,"saved_search_matches_delete_own"))

    def test_realistic_rendered_policy_ddl_accepted_without_execution(self):
        sql=('CREATE POLICY saved_search_matches_select_own ON public.saved_search_matches FOR SELECT TO authenticated USING ((user_id = auth.uid()));\n'
             'CREATE POLICY saved_search_matches_delete_own ON public.saved_search_matches FOR DELETE TO authenticated USING ((user_id = auth.uid()));')
        result=mod.inspect_ddl(sql)
        self.assertEqual(result["real_archived_policies_selected"],2)
        self.assertFalse(result["sql_executed"])
        self.assertFalse(result["database_modified"])

    def test_reject_duplicate_ddl_and_dml(self):
        sql=('CREATE POLICY saved_search_matches_select_own ON public.saved_search_matches FOR SELECT;\n'
             'CREATE POLICY saved_search_matches_delete_own ON public.saved_search_matches FOR DELETE;\n')
        with self.assertRaises(ValueError):
            mod.inspect_ddl(sql+sql)
        with self.assertRaises(ValueError):
            mod.inspect_ddl(sql+"\nDELETE FROM public.saved_search_matches;")

    def test_no_db_execution_or_private_sql_printing(self):
        src=SRC.read_text()
        for token in ('"--list"', '"--file"', 'TemporaryDirectory(', 'getpass.getpass(',
                      'PREFLIGHT["run"]', 'sql_executed', 'NOT_CERTIFIED:'):
            self.assertIn(token,src)
        for token in ('"--dbname"', '"--clean"', 'shell=True', 'print(sql)', 'print(secret)'):
            self.assertNotIn(token,src)

if __name__=="__main__":
    unittest.main()
