#!/usr/bin/env python3
"""Offline contract: a catalog snapshot must never be mislabeled a full DR."""
from pathlib import Path
import re
sql=Path("scripts/pilot-dr-prod-inventory-readonly.sql").read_text()
assert "BEGIN TRANSACTION READ ONLY" in sql
assert sql.strip().endswith("ROLLBACK;")
assert all(x in sql for x in ("auth.users","storage.buckets","storage.objects",
     "pg_policies","pg_tables","pg_database_size"))
assert "INVENTORY_ONLY__FULL_AUTH_STORAGE_RECOVERY_UNVERIFIED" in sql
for forbidden in ("auth.users.email", "storage.objects.name",
   "SELECT *", "DROP TABLE", "CREATE TABLE", "REVOKE SELECT", "GRANT SELECT"):
    assert forbidden not in sql, "Forbidden PII or DDL in inventory: "+forbidden
assert not re.search(r"(?im)^\s*(insert|update|delete|alter|drop|create|grant|revoke|truncate)\b",sql)
print("PASS: metadata-only DR inventory covers DB/Auth/Storage, fails closed on full recovery")
