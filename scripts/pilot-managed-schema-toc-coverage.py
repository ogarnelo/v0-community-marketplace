#!/usr/bin/env python3
"""Offline audit of Auth/Storage coverage in a decrypted pg_restore TOC.

Never opens rows or authenticates to Supabase. The summary is *informational*:
even 74/74 managed-schema TOC sections do not certify GoTrue runtime, object
bytes, keys, secrets or an actual full restore.
"""
import argparse
import json
from pathlib import Path

from pilot_db_backup_toc_compat import parse_toc

AUTH = frozenset("""
audit_log_entries custom_oauth_providers flow_state identities instances
mfa_amr_claims mfa_challenges mfa_factors mfa_recovery_code_sets
mfa_recovery_codes oauth_authorizations oauth_client_states oauth_clients
oauth_consents one_time_tokens refresh_tokens saml_providers saml_relay_states
schema_migrations scim_tokens scim_users sessions sso_domains sso_providers
users webauthn_challenges webauthn_credentials
""".split())
STORAGE = frozenset("""
bucket_lifecycle_states buckets buckets_analytics buckets_vectors
lifecycle_abandoned_artifacts migrations objects s3_multipart_uploads
s3_multipart_uploads_parts vector_indexes
""".split())

def assess(text):
    toc = parse_toc(text)
    outcome = {}
    for schema, names in (("auth", AUTH), ("storage", STORAGE)):
        found_tables = sum((schema, name, "TABLE") in toc for name in names)
        found_data = sum((schema, name, "TABLE DATA") in toc for name in names)
        both = sum(
            (schema, name, "TABLE") in toc
            and (schema, name, "TABLE DATA") in toc for name in names)
        outcome[schema] = {
            "catalog_tables_expected": len(names),
            "toc_table_definitions": found_tables,
            "toc_table_data_sections": found_data,
            "toc_table_and_data_pairs": both,
            "toc_sections_expected": len(names) * 2,
            "toc_sections_present": found_tables + found_data,
            "toc_complete_for_known_tables": both == len(names),
        }
    return {
        "inventory_as_of": "2026-11-11",
        "schemas": outcome,
        "any_real_auth_or_storage_rows_restored": False,
        "physical_storage_object_bytes_recovered": False,
        "gotrue_runtime_restored": False,
        "full_disaster_recovery_certified": False,
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("toc", help="Previously decrypted pg_restore --list metadata")
    parser.add_argument("--require-managed-toc", action="store_true",
                        help="Fail if any known auth/storage section missing")
    args = parser.parse_args()
    result = assess(Path(args.toc).read_text(encoding="utf-8", errors="replace"))
    print(json.dumps(result, sort_keys=True))
    if args.require_managed_toc and not all(
        item["toc_complete_for_known_tables"]
        for item in result["schemas"].values()
    ):
        print("BLOCKED: managed Auth/Storage TOC incomplete", flush=True)
        return 2
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
