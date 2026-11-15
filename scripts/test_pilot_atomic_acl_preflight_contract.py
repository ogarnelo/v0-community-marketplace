"""P0: guard against silent weakening of the reviewed PostgreSQL ACL proposal."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
SQL=(ROOT/"scripts/pilot-listings-atomic-acl-review-only.sql").read_text()
PG17=(ROOT/"scripts/pilot-listings-atomic-acl-pg17.py").read_text()

class ACLPreflight(unittest.TestCase):
    def test_atomic_sql_rejects_unsafe_baselines_before_first_revoke(self):
        pre=SQL.split("REVOKE SELECT ON TABLE public.listings",1)[0]
        for fragment in (
            "relrowsecurity",
            "unexpected direct anon/public column grant",
            "aclexplode(a.attacl)",
            "'SELECT','INSERT','UPDATE'",
            "unexpected listings schema",
            "has_table_privilege('service_role','public.listings','SELECT')",
        ):
            with self.subTest(fragment=fragment):
                self.assertIn(fragment,pre)
        self.assertEqual(SQL.count("BEGIN;"),1)
        self.assertEqual(SQL.count("COMMIT;"),1)
        self.assertIn("NO_GO_ATOMIC_ACL",SQL)

    def test_runner_has_fail_closed_cases_for_drift_column_acl_and_rls(self):
        for marker in (
            "wetudy_qa_atomic_acl_rollback",
            "wetudy_qa_atomic_acl_drift",
            "wetudy_qa_atomic_acl_column_acl",
            "wetudy_qa_atomic_acl_rls_off",
            "GRANT SELECT (postal_code)",
            "ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY",
            "unexpected direct anon/public column grant",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker,PG17)
        self.assertIn("DROP DATABASE IF EXISTS",PG17)

if __name__=="__main__":
    unittest.main()
