#!/usr/bin/env python3
"""Privacy-safe WETUDY three-AMPA gate. Never claims production GO by itself.

Local CSV must contain only coded slots, no PII. Do not commit completed CSV.
Usage: python3 scripts/pilot-three-ampa-signoff-gate.py local_ampa_status.csv
"""
import argparse
import csv
from pathlib import Path
import sys

COLUMNS=("ampa_code","adult_rep_confirmed","decision","p0_open","tests_run","tests_pass")
SLOTS={"AMPA-01","AMPA-02","AMPA-03"}

class PilotBlocked(ValueError):
    pass

def evaluate(rows):
    if len(rows)!=3:
        raise PilotBlocked("Exactly three independent AMPA slots are required")
    codes=set()
    for row in rows:
        if set(row)!=set(COLUMNS):
            raise PilotBlocked("Unexpected fields; personal information not allowed")
        code=row["ampa_code"]
        if code not in SLOTS or code in codes:
            raise PilotBlocked("Duplicate or unexpected AMPA slot")
        codes.add(code)
        if row["adult_rep_confirmed"]!="yes" or row["decision"]!="ACEPTO":
            raise PilotBlocked("Adult acceptance not recorded for every AMPA")
        if row["p0_open"]!="0":
            raise PilotBlocked("Open P0 blocks the pilot")
        try:
            executed=int(row["tests_run"])
            passed=int(row["tests_pass"])
        except (ValueError,TypeError) as exc:
            raise PilotBlocked("Invalid acceptance test count") from exc
        if not (executed==14 and passed==14):
            raise PilotBlocked("The 14 required scenarios must all pass")
    if codes!=SLOTS:
        raise PilotBlocked("AMPA slots missing")
    return {"ampa_certificates":3,"scenarios_passed":42,
            "privacy_release_authorized":False,"dr_certified":False,
            "production_launch_authorized":False}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path",help="Local CSV with coded AMPA slots only")
    args=parser.parse_args()
    try:
        path=Path(args.csv_path)
        if path.is_symlink() or not path.is_file() or path.stat().st_size>4096:
            raise PilotBlocked("Unsafe or oversized CSV")
        with path.open(newline="",encoding="utf-8-sig") as file:
            reader=csv.DictReader(file)
            if reader.fieldnames!=list(COLUMNS):
                raise PilotBlocked("Invalid or personal CSV columns")
            result=evaluate(list(reader))
    except (PilotBlocked,OSError,csv.Error) as exc:
        print("NO_GO_AMPA: "+exc.__class__.__name__,file=sys.stderr)
        return 2
    print("AMPA_ACCEPTANCE_CANDIDATE_PASS: 3 signed adult slots, 42 synthetic scenarios.")
    print("NOT_LAUNCH_AUTHORIZATION: requires #447 privacy, #455 real DR, independent signatures and founder approval.")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
