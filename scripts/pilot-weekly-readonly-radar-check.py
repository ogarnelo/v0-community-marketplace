#!/usr/bin/env python3
"""Guard against accidentally adding DML/DDL to Wetudy's manual radar query."""
import re
from pathlib import Path

SQL=Path(__file__).with_name("pilot-weekly-readonly-radar.sql")
BANNED={"insert","update","delete","truncate","drop","alter","create","grant",
        "revoke","call","execute","copy","vacuum","merge","refresh"}

def scan(text):
    clean=re.sub(r"/\*.*?\*/","",text,flags=re.S)
    clean="\n".join(line.split("--",1)[0] for line in clean.splitlines()).strip()
    if not clean.lower().startswith("with "):
        raise AssertionError("Radar must start with a read-only CTE")
    if clean.count(";")!=1 or not clean.endswith(";"):
        raise AssertionError("Radar must have one single SQL statement")
    words=set(re.findall(r"[a-z_]+",re.sub(r"'(?:''|[^'])*'","''",clean.lower())))
    forbidden=sorted(BANNED & words)
    if forbidden:
        raise AssertionError("Radar must not include DML/DDL: "+", ".join(forbidden))
    for required in ("school_assignment_guard_present","demo_total","postgres_bytes",
                     "storage_bucket_aggregates","profiles_linked_to_nonactive_school"):
        if required not in clean:
            raise AssertionError("Pilot safety metric missing: "+required)
    return True

def main():
    scan(SQL.read_text())
    for payload in ("\nDELETE FROM public.profiles", "\nUPDATE public.schools SET is_active=true",
                    "\nDROP TABLE public.listings"):
        try:
            scan(SQL.read_text().rstrip().rstrip(";")+payload+";")
        except AssertionError:
            continue
        raise AssertionError("Radar safety test accepted a write operation")
    print("PASS offline single-read-only-query gate and three hostile SQL mutations denied.")

if __name__=="__main__":
    main()
