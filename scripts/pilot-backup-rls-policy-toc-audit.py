#!/usr/bin/env python3
"""Report RLS POLICY entries in pg_restore TOC; never access table rows.

A POLICY entry records dump metadata, not a deployed or tested PostgreSQL
policy after restore. pg_dump --no-acl also omits grants, independent of POLICY.
"""
import argparse
import json
import re
from pathlib import Path

POLICY = re.compile(
    r"^\s*\d+;\s+\d+\s+\d+\s+POLICY\s+(public|storage|auth)\s+"
    r"([A-Za-z_][A-Za-z0-9_]*)\s+"
)
# Live pg_policy counts captured 2026-11-11 by read-only catalog query.
BASELINE = {"public": 140, "storage": 3, "auth": 0}
IMPORTANT = frozenset({
    "saved_searches", "saved_search_matches", "user_marketplace_preferences",
    "profiles", "listings", "listing_photos", "schools", "school_codes",
    "school_access_codes", "user_roles", "notifications",
})

def assess(contents):
    totals = {schema: 0 for schema in BASELINE}
    protected = set()
    for line in contents.splitlines():
        m = POLICY.match(line)
        if not m:
            continue
        schema,table = m.group(1),m.group(2)
        totals[schema] += 1
        if schema == "public" and table in IMPORTANT:
            protected.add(table)
    return {
        "baseline_as_of": "2026-11-11",
        "policy_toc_entries": totals,
        "read_only_catalog_reference": BASELINE,
        "public_policy_count_matches_baseline": totals["public"] == BASELINE["public"],
        "storage_policy_count_matches_baseline": totals["storage"] == BASELINE["storage"],
        "important_public_tables_with_policy_toc": len(protected),
        "important_public_tables_expected": len(IMPORTANT),
        "important_policy_table_coverage": len(protected) == len(IMPORTANT),
        "sql_grants_recovered_from_no_acl_dump": False,
        "policies_applied_to_restored_database": False,
        "rls_runtime_authorization_certified": False,
        "full_disaster_recovery_certified": False,
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("toc", help="Locally decrypted pg_restore --list metadata")
    parser.add_argument("--require-policy-baseline", action="store_true",
                        help="Fail on baseline drift (opt-in; not a DR certificate)")
    args = parser.parse_args()
    result = assess(Path(args.toc).read_text(encoding="utf8",errors="replace"))
    print(json.dumps(result,sort_keys=True))
    if args.require_policy_baseline and not (
        result["public_policy_count_matches_baseline"]
        and result["storage_policy_count_matches_baseline"]
        and result["important_policy_table_coverage"]
    ):
        print("BLOCKED: RLS policy TOC baseline drift")
        return 2
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
