#!/usr/bin/env python3
"""Pilot release evidence gate: fail closed by default, no identities or PII.

Reads a private LOCAL JSON evidence manifest on an authorized operator machine.
No API calls, no real user provisioning, no production actions. NEVER commit
manifest with actual identifiers, private links or credentials to GitHub.
"""
import argparse
import json
import re
from pathlib import Path
import sys

GATES = ("privacy_447", "disaster_recovery_455", "authenticated_e2e_245")
CASES = ("turnstile_email", "family_isolation", "school_approval",
         "listing_postal_radius", "chat_agreement", "moderation_email",
         "mobile_smoke", "cleanup")
AMPA_KEYS = ("ampa_1", "ampa_2", "ampa_3")

def assess(manifest):
    if not isinstance(manifest, dict) or set(manifest) != {"gates", "ampa"}:
        return {"go": False, "reason": "MANIFEST_SHAPE"}
    gates = manifest["gates"]
    if not isinstance(gates, dict) or set(gates) != set(GATES):
        return {"go": False, "reason": "GATE_SHAPE"}
    # No production certification is conferred by this script.
    if not all(gates[k] is True for k in GATES):
        return {"go": False, "reason": "P0_GATE_UNRESOLVED"}
    schools = manifest["ampa"]
    if not isinstance(schools, dict) or set(schools) != set(AMPA_KEYS):
        return {"go": False, "reason": "AMPA_COUNT"}
    evidence = set()
    for key in AMPA_KEYS:
        value = schools[key]
        if not isinstance(value, dict) or set(value) != {"approved", "cases", "evidence_reference"}:
            return {"go": False, "reason": "AMPA_RECORD_INVALID"}
        if value["approved"] is not True:
            return {"go": False, "reason": "AMPA_NOT_APPROVED"}
        cases = value["cases"]
        if not isinstance(cases, dict) or set(cases) != set(CASES):
            return {"go": False, "reason": "AMPA_CASES_MISSING"}
        if not all(cases[k] is True for k in CASES):
            return {"go": False, "reason": "AMPA_CASE_NOT_VERIFIED"}
        # Private opaque references only: never print or resolve them.
        ref = value["evidence_reference"]
        if not isinstance(ref, str) or len(ref) < 12 or len(ref) > 80 or not ref.startswith("private:"):
            return {"go": False, "reason": "AMPA_EVIDENCE_MISSING"}
        # CI and local fixtures must never count as participant acceptance,
        # even if all other checklist flags are set true.
        if ref.lower().startswith((
            "private:synthetic-", "private:fixture-", "private:demo-",
            "private:test-", "private:ci-", "private:sample-",
        )):
            return {"go": False, "reason": "AMPA_SYNTHETIC_EVIDENCE"}
        if not re.fullmatch(r"private:[A-Za-z0-9][A-Za-z0-9_-]{3,71}", ref):
            return {"go": False, "reason": "AMPA_EVIDENCE_FORMAT"}
        if any(token in ref.lower() for token in (
            "synthetic", "fixture", "sample", "dummy", "fake",
            "placeholder", "example",
        )):
            return {"go": False, "reason": "AMPA_SYNTHETIC_EVIDENCE"}
        if ref in evidence:
            return {"go": False, "reason": "AMPA_DUPLICATE_EVIDENCE"}
        evidence.add(ref)
    # A local JSON with boolean flags is SELF-DECLARED evidence.
    # It must not be represented as authorization to launch WETUDY.
    return {"go": False, "ready_for_human_review": True,
            "reason": "MANIFEST_DECLARED_READY_HUMAN_APPROVAL_REQUIRED"}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True)
    args = parser.parse_args()
    try:
        raw_path = Path(args.manifest).expanduser()
        if raw_path.is_symlink():
            raise ValueError("manifest symlink")
        p = raw_path.resolve(strict=True)
        if not p.is_file() or p.stat().st_size > 32768:
            raise ValueError("manifest unsafe")
        with p.open(encoding="utf-8") as f:
            obj = json.load(f)
        result = assess(obj)
    except (OSError, ValueError, UnicodeError, json.JSONDecodeError):
        result = {"go": False, "reason": "READ_ERROR"}
    if result.get("ready_for_human_review") is True:
        print("READY_FOR_HUMAN_RELEASE_REVIEW: all manifest flags declared true")
        print("NOT_CERTIFIED: declarations are not independently verified; human review required")
        # Exit != 0 intentionally: CI and deploy workflows must not interpret
        # an unchecked local JSON as a release approval. Code 3 = human review.
        return 3
    print("NO_GO_PILOT: " + result["reason"])
    return 2

if __name__ == "__main__":
    sys.exit(main())
