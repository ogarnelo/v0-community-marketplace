"""Guard the PR path filter for the REAL isolated AMPA / Auth / PostgREST workflow.

This test does not claim human AMPA acceptance or validate production traffic.
It prevents changes to key marketplace surfaces from silently skipping local E2E.
"""
from pathlib import Path
import unittest

WORKFLOW=Path(".github/workflows/pilot-three-ampa-real-next-browser.yml")
CRITICAL=Path(".github/workflows/contracts.yml")
REQUIRED=(
    "app/admin/school/page.tsx",
    "app/marketplace/listing/[id]/page.tsx",
    "app/marketplace/page.tsx",
    "app/api/marketplace/feed/route.ts",
    "app/api/marketplace/my-school/route.ts",
    "app/api/marketplace/listing-draft/route.ts",
    "app/api/schools/public/route.ts",
    "app/api/messages/**",
    "components/messages/**",
    "components/marketplace/**",
    "scripts/pilot-privacy-client-surface-gate.mjs",
    "scripts/pilot-listings-atomic-acl-review-only.sql",
    "scripts/pilot-privacy-real-grants-postgrest-qa.sql",
    "scripts/test_pilot_e2e_workflow_trigger_coverage.py",
)

class TriggerCoverage(unittest.TestCase):
    def test_real_local_e2e_responds_to_marketplace_and_acl_changes(self):
        lines=WORKFLOW.read_text(encoding="utf-8").splitlines()
        self.assertIn("  pull_request:",lines)
        start=lines.index("    paths:")
        # Only top-level, two-space YAML keys terminate the PR paths clause.
        selected=[]
        for line in lines[start+1:]:
            if line and not line.startswith("      "):
                break
            if line.startswith("      - "):
                selected.append(line.split("      - ",1)[1].strip().strip('"'))
        for name in REQUIRED:
            with self.subTest(name=name):
                self.assertIn(name,selected)

    def test_workflow_is_local_and_never_uses_production_secrets(self):
        text=WORKFLOW.read_text(encoding="utf-8")
        for fragment in ("supabase@2.121.0", "LOCAL_SUPABASE_URL",
                         "LOCAL_SUPABASE_SERVICE_KEY", "127.0.0.1",
                         "scripts/pilot-privacy-real-grants-postgrest-qa.cjs",
                         "scripts/pilot-three-ampa-real-next-browser.cjs"):
            self.assertIn(fragment,text)

    def test_trigger_contract_runs_on_all_pull_requests(self):
        text=CRITICAL.read_text(encoding="utf-8")
        self.assertIn("  pull_request:",text)
        self.assertIn("scripts/test_pilot_e2e_workflow_trigger_coverage.py",text)

if __name__=="__main__":
    unittest.main()
