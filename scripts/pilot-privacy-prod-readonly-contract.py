#!/usr/bin/env python3
"""Fail-closed code contract only: production preflight stays READ ONLY and audits anon DML."""
from pathlib import Path
import re

source=Path("scripts/pilot-privacy-prod-preflight-readonly.sql").read_text()
assert "BEGIN TRANSACTION READ ONLY" in source
assert source.rstrip().endswith("ROLLBACK;")
for word in ("anon_insert", "anon_update", "anon_delete", "anon_dml_gate",
             "NO_GO_ANON_DML_GRANTS", "PASS_ANON_DML_GRANTS_REVOKED",
             "auth_insert", "auth_update", "auth_delete", "NO_GO_PRIVACY",
             "anon_centroid_select", "NO_GO_GEO_RPC"):
    assert word in source, "Missing privacy gate: " + word
for op in ("INSERT","UPDATE","DELETE"):
    assert f"has_table_privilege('anon','public.listings','{op}')" in source
# Ignore SQL comments; reject any actual data mutations in this audit script.
clean="\n".join(line.split("--")[0] for line in source.splitlines())
assert not re.search(r"(?im)^\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|REVOKE|TRUNCATE)\b", clean)
print("PASS: production preflight remains read-only and reports all anon DML grants separately")
