"""No real families or AMPA participants in automated tests."""
import importlib.util
from pathlib import Path
import unittest

SRC=Path(__file__).with_name("pilot-three-ampa-release-evidence-gate.py")
sp=importlib.util.spec_from_file_location("ampa_release",SRC)
gate=importlib.util.module_from_spec(sp)
sp.loader.exec_module(gate)

def manifest():
    return {"gates":{key:True for key in gate.GATES},
            "ampa":{key:{"approved":True,
              "cases":{c:True for c in gate.CASES},
              "evidence_reference":"private:real-evidence-"+key}
              for key in gate.AMPA_KEYS}}

class ReleaseEvidenceTests(unittest.TestCase):
    def test_blank_and_partial_are_no_go(self):
        for obj in ({}, {"gates":{},"ampa":{}}, {"gates":{}},
                    {"gates":{key:True for key in gate.GATES},"ampa":{}}):
            self.assertFalse(gate.assess(obj)["go"])
    def test_each_p0_gate_blocks(self):
        for key in gate.GATES:
            x=manifest()
            x["gates"][key]=False
            self.assertEqual(gate.assess(x)["reason"],"P0_GATE_UNRESOLVED")
    def test_each_ampa_case_blocks(self):
        for school in gate.AMPA_KEYS:
            for case in gate.CASES:
                x=manifest()
                x["ampa"][school]["cases"][case]=False
                self.assertEqual(gate.assess(x)["reason"],"AMPA_CASE_NOT_VERIFIED")
    def test_missing_approval_or_evidence_blocks(self):
        x=manifest(); x["ampa"]["ampa_2"]["approved"]=False
        self.assertEqual(gate.assess(x)["reason"],"AMPA_NOT_APPROVED")
        x=manifest(); x["ampa"]["ampa_1"]["evidence_reference"]=""
        self.assertEqual(gate.assess(x)["reason"],"AMPA_EVIDENCE_MISSING")
        x=manifest(); x["ampa"]["ampa_3"]["evidence_reference"]=x["ampa"]["ampa_1"]["evidence_reference"]
        self.assertEqual(gate.assess(x)["reason"],"AMPA_DUPLICATE_EVIDENCE")
    def test_synthetic_or_demo_references_never_count_as_real_ampa(self):
        for prefix in ("synthetic-", "fixture-", "demo-", "test-", "ci-", "sample-"):
            case=manifest()
            case["ampa"]["ampa_2"]["evidence_reference"]="private:"+prefix+"fake-ampa-2"
            self.assertEqual(gate.assess(case)["reason"], "AMPA_SYNTHETIC_EVIDENCE")
        case=manifest()
        case["ampa"]["ampa_1"]["evidence_reference"]="private:real-evidence-ampa_1"
        self.assertEqual(gate.assess(case)["reason"],
                         "MANIFEST_DECLARED_READY_HUMAN_APPROVAL_REQUIRED")

    def test_private_refs_deny_identifiers_urls_and_camouflaged_fixtures(self):
        invalid={
            "private:approved@ampa.edu": "AMPA_EVIDENCE_FORMAT",
            "private:https://example.org/report": "AMPA_EVIDENCE_FORMAT",
            "private:real_dummy_evidence_ampa1": "AMPA_SYNTHETIC_EVIDENCE",
            "private:real-placeholder-ampa1": "AMPA_SYNTHETIC_EVIDENCE",
            "private:real_sample_ampa1": "AMPA_SYNTHETIC_EVIDENCE",
        }
        for ref, reason in invalid.items():
            with self.subTest(ref=ref):
                x=manifest()
                x["ampa"]["ampa_1"]["evidence_reference"]=ref
                self.assertEqual(gate.assess(x)["reason"],reason)

    def test_all_true_is_only_declaration(self):
        result=gate.assess(manifest())
        self.assertEqual(result["reason"],
            "MANIFEST_DECLARED_READY_HUMAN_APPROVAL_REQUIRED")
        self.assertIs(result["go"],False)
        self.assertIs(result["ready_for_human_review"],True)
        self.assertIn("NOT_CERTIFIED",SRC.read_text())
    def test_cli_never_declares_launch_authorized_from_manifest(self):
        import json
        import subprocess
        import sys
        import tempfile
        with tempfile.TemporaryDirectory(prefix="wetudy-ampa-synthetic-") as d:
            path=Path(d)/"evidence.json"
            path.write_text(json.dumps(manifest()))
            result=subprocess.run([sys.executable,str(SRC),"--manifest",str(path)],
                                  text=True,capture_output=True,timeout=10)
        self.assertEqual(result.returncode,0)
        self.assertIn("READY_FOR_HUMAN_RELEASE_REVIEW",result.stdout)
        self.assertIn("NOT_CERTIFIED",result.stdout)
        self.assertNotIn("GO_PILOT:",result.stdout)

    def test_reject_extra_fields_and_string_true(self):
        x=manifest();x["gates"]["privacy_447"]="true"
        self.assertFalse(gate.assess(x)["go"])
        x=manifest();x["ampa"]["ampa_1"]["child_email"]="test@example.com"
        self.assertEqual(gate.assess(x)["reason"],"AMPA_RECORD_INVALID")
if __name__=="__main__":
    unittest.main()
