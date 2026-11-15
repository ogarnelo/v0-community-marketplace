"""DR completion must never be inferred from six-table synthetic restore."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/pilot-dr-scope-audit.py"

class DRScopeReleaseGate(unittest.TestCase):
    def test_machine_readable_inventory_and_uncertified_flag(self):
        result=subprocess.run([sys.executable,str(SCRIPT)],capture_output=True,
                              text=True,timeout=10,check=False)
        self.assertEqual(result.returncode,0)
        data=json.loads(result.stdout)
        self.assertEqual(data["total_public_tables"],79)
        self.assertGreaterEqual(data["untested_public_tables"],1)
        self.assertIs(data["ready_for_full_production_restore"],False)
        self.assertIn("GoTrue Auth runtime, users, identities and configuration",
                      data["additional_required_components"])
        self.assertIn("Storage physical private object bytes and policies",
                      data["additional_required_components"])
        self.assertIn("listings",data["missing_by_critical_workflow"])
        self.assertIn("messages",data["missing_by_critical_workflow"])

    def test_full_restore_gate_is_always_no_go_until_real_evidence(self):
        result=subprocess.run([sys.executable,str(SCRIPT),"--require-full-coverage"],
                              capture_output=True,text=True,timeout=10,check=False)
        self.assertEqual(result.returncode,2)
        self.assertIn("NOT a full production disaster-recovery drill",result.stderr)
        self.assertFalse(json.loads(result.stdout)["ready_for_full_production_restore"])

if __name__=="__main__":
    unittest.main()
