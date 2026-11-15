#!/usr/bin/env python3
"""Static contract for the production SQL preflight: metadata-only chat RLS gate."""
from pathlib import Path
import re
sql=Path("scripts/pilot-privacy-prod-preflight-readonly.sql").read_text()
assert "BEGIN TRANSACTION READ ONLY" in sql
assert sql.strip().endswith("ROLLBACK;")
for token in ("conversations","messages","auth.uid","buyer_id","seller_id",
 "relrowsecurity","anon_table_read","member_scoped_policy",
 "NO_GO_CHAT_RLS_CATALOG","PASS_CHAT_RLS_CATALOG"):
    assert token in sql, "Chat RLS preflight missing "+token
clean="\n".join(line.split("--")[0] for line in sql.splitlines())
assert not re.search(r"(?im)^\s*(insert|update|delete|alter|drop|create|grant|revoke|truncate)\b", clean)
print("PASS: chat RLS preflight remains read-only and requires owner scoped policies")
