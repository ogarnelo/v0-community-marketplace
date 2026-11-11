#!/usr/bin/env python3
"""Verify a metadata-only Wetudy ACL snapshot before/after encrypted backup.

Never connects to production. Rejects truncated, duplicated or non-ACL JSON.
Prints canonical validated JSON (use output redirection to a private file).
"""
import json
import sys

TABLES = set("""saved_searches saved_search_matches user_marketplace_preferences
profiles listings listing_photos schools school_codes school_access_codes
user_roles notifications""".split())
ROLES = {"anon", "authenticated"}
PERMS = {"SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE",
         "REFERENCES", "TRIGGER", "MAINTAIN"}
FIELDS = {"table_name", "grantee_role", "privilege_name", "effective_privilege",
          "direct_grant_count", "direct_grantors", "direct_grant_option"}


def validate(payload):
    if not isinstance(payload, list) or len(payload) != 176:
        raise ValueError("Invalid ACL snapshot size; expected 176 entries")
    keys = set()
    for row in payload:
        if not isinstance(row, dict) or set(row) != FIELDS:
            raise ValueError("Unexpected ACL metadata fields")
        if (row["table_name"] not in TABLES
                or row["grantee_role"] not in ROLES
                or row["privilege_name"] not in PERMS):
            raise ValueError("Unexpected ACL scope")
        if (type(row["effective_privilege"]) is not bool
                or type(row["direct_grant_option"]) is not bool
                or type(row["direct_grant_count"]) is not int
                or row["direct_grant_count"] < 0
                or not isinstance(row["direct_grantors"], str)
                or len(row["direct_grantors"]) > 512
                or (row["direct_grant_count"] > 0) != bool(row["direct_grantors"])):
            raise ValueError("Malformed ACL grant")
        key = (row["table_name"], row["grantee_role"], row["privilege_name"])
        if key in keys:
            raise ValueError("Duplicate ACL tuple")
        keys.add(key)
    if len(keys) != len(TABLES) * len(ROLES) * len(PERMS):
        raise ValueError("Incomplete ACL coverage")
    return sorted(payload, key=lambda x: (
        x["table_name"], x["grantee_role"], x["privilege_name"]))


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: pilot-backup-acl-snapshot-validate.py SNAPSHOT.json")
    # PostgreSQL psql -qAt emits raw JSON without BEGIN/COMMIT command tags.
    with open(sys.argv[1], encoding="utf-8") as fh:
        data = json.load(fh)
    result = validate(data)
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print("BLOCKED: ACL metadata snapshot validation failed: " +
              str(error), file=sys.stderr)
        raise SystemExit(2)
