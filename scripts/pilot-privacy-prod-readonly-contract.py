#!/usr/bin/env python3
"""Fail-closed code contract only: production preflight stays READ ONLY and audits anon DML."""
from pathlib import Path
import re

source=Path("scripts/pilot-privacy-prod-preflight-readonly.sql").read_text()
assert "BEGIN TRANSACTION READ ONLY" in source
assert source.rstrip().endswith("ROLLBACK;")
for word in ("anon_insert", "anon_update", "anon_delete", "anon_dml_gate",
             "NO_GO_ANON_DML_GRANTS", "PASS_ANON_DML_GRANTS_REVOKED",
             "anon_insert_columnwise", "anon_update_columnwise",
             "has_any_column_privilege",
             "direct_anon_public_column_insert_grants",
             "direct_anon_public_column_update_grants", "aclexplode(a.attacl)",
             "auth_insert", "auth_update", "auth_delete", "NO_GO_PRIVACY",
             "anon_centroid_select", "NO_GO_GEO_RPC"):
    assert word in source, "Missing privacy gate: " + word
for op in ("INSERT","UPDATE","DELETE"):
    assert f"has_table_privilege('anon','public.listings','{op}')" in source
# Column grants must be included in the effective NO-GO CASE, not just reported.
dml_case = source.split("CASE WHEN has_table_privilege('anon','public.listings','INSERT')",1)[1].split("END AS anon_dml_gate",1)[0]
for op in ("INSERT","UPDATE"):
    assert f"has_any_column_privilege('anon','public.listings','{op}')" in dml_case
proposal=Path("scripts/pilot-anon-listings-dml-hardening-proposal.sql").read_text()
for op in ("INSERT","UPDATE"):
    assert f"has_any_column_privilege('anon','public.listings','{op}')" in proposal
# Admin role grants may exist at table level; RLS + helper must still gate escalation.
for token in ("NO_GO_ADMIN_ROLE_ESCALATION_CATALOG",
              "PASS_ADMIN_RLS_CATALOG_NEEDS_E2E","private_security_definer",
              "private_uid_check","private_role_check","private_anon_execute",
              "public_security_invoker","public_anon_execute",
              "admin_insert_only","admin_update_only","admin_delete_only"):
    assert token in source, "missing admin-role catalog control: "+token
assert "tablename='user_roles'" in source
# Ignore SQL comments; reject any actual data mutations in this audit script.
clean="\n".join(line.split("--")[0] for line in source.splitlines())
assert not re.search(r"(?im)^\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|REVOKE|TRUNCATE)\b", clean)
print("PASS: production preflight remains read-only and reports all anon DML grants separately")
