import unittest
import runpy
from pathlib import Path
m=runpy.run_path(str(Path(__file__).with_name("pilot-three-ampa-signoff-gate.py")))
evaluate=m["evaluate"]
PilotBlocked=m["PilotBlocked"]

def rows():
    return [dict(ampa_code="AMPA-0"+str(i),adult_rep_confirmed="yes",
      decision="ACEPTO",p0_open="0",tests_run="14",tests_pass="14") for i in (1,2,3)]

class AmPaGateTests(unittest.TestCase):
    def test_three_all_pass_still_not_production_go(self):
        x=evaluate(rows())
        self.assertEqual(x["ampa_certificates"],3)
        self.assertFalse(x["privacy_release_authorized"])
        self.assertFalse(x["dr_certified"])
        self.assertFalse(x["production_launch_authorized"])
    def test_zero_ampa_is_blocked(self):
        with self.assertRaises(PilotBlocked):
            evaluate([])
    def test_one_or_two_amPa_block(self):
        for n in (1,2):
            with self.assertRaises(PilotBlocked):
                evaluate(rows()[:n])
    def test_duplicate_or_missing_p0_block(self):
        x=rows();x[2]["ampa_code"]="AMPA-02"
        with self.assertRaises(PilotBlocked):
            evaluate(x)
        x=rows();x[0]["p0_open"]="1"
        with self.assertRaises(PilotBlocked):
            evaluate(x)
    def test_no_real_adult_acceptance_or_missing_test(self):
        x=rows();x[1]["adult_rep_confirmed"]="no"
        with self.assertRaises(PilotBlocked):
            evaluate(x)
        x=rows();x[1]["tests_pass"]="13"
        with self.assertRaises(PilotBlocked):
            evaluate(x)
    def test_reject_personal_contact_fields(self):
        x=rows();x[0]["parent_email"]="private@example.invalid"
        with self.assertRaises(PilotBlocked):
            evaluate(x)

if __name__=="__main__":
    unittest.main()
