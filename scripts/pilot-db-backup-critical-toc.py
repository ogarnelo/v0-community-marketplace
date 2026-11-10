#!/usr/bin/env python3
"""Inspect pg_restore --list metadata; never read private table rows.

Checks that a freshly encrypted Wetudy pg_dump can at least identify public
schema definitions and DATA sections for essential pilot entities.
TOC existence is NOT proof that data are present or that a full restore works.
"""
import argparse
import json
import re
import sys
from pathlib import Path

CRITICAL_PUBLIC = {
    "families": ("profiles", "account_students", "user_roles"),
    "marketplace": ("listings", "listing_photos", "listing_offers"),
    "communications": ("conversations", "messages", "notifications"),
    "transactions": ("agreements", "payment_intents", "payment_events"),
    "nearby_search_and_alerts": (
        "marketplace_postal_centroids", "marketplace_alert_outbox",
        "saved_searches", "saved_search_matches",
        "transactional_email_deliveries", "transactional_email_recipient_health",
    ),
}
MANAGED = {
    "auth": ("users", "identities"),
    "storage": ("objects",),
}
TOC_LINE = re.compile(
    r"^\s*\d+;\s+\d+\s+\d+\s+(TABLE(?: DATA)?)\s+([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s"
)

def parse_toc(content):
    entries = set()
    for line in content.splitlines():
        match = TOC_LINE.match(line)
        if match:
            entries.add((match.group(2), match.group(3), match.group(1)))
    return entries

def assess(contents):
    entries = parse_toc(contents)
    missing = {}
    for area, names in CRITICAL_PUBLIC.items():
        for name in names:
            for kind in ("TABLE", "TABLE DATA"):
                if ("public", name, kind) not in entries:
                    missing.setdefault(area, []).append(name + ":" + kind.lower().replace(" ", "_"))
    managed = {
        area: {
            name: all((area,name,kind) in entries for kind in ("TABLE", "TABLE DATA"))
            for name in names
        }
        for area, names in MANAGED.items()
    }
    return {
        "public_toc_sections_checked": sum(map(len, CRITICAL_PUBLIC.values())) * 2,
        "critical_public_toc_ready": not missing,
        "missing_critical_public_toc": missing,
        "managed_auth_storage_toc_present": managed,
        "full_disaster_recovery_certified": False,
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("toc_path", help="Local pg_restore --list output ONLY")
    args = p.parse_args()
    content = Path(args.toc_path).read_text(encoding="utf-8",errors="replace")
    result = assess(content)
    print(json.dumps(result,sort_keys=True))
    if not result["critical_public_toc_ready"]:
        print("BLOCKED: Critical tables missing from encrypted backup TOC",file=sys.stderr)
        return 2
    print("TOC gate PASS: no row data inspected, full DB restore NOT certified")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
