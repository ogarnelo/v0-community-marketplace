#!/usr/bin/env python3
"""Fail closed on missing or unsafe cross-table ACL audit; does not connect to Supabase."""
from pathlib import Path
import re
sql=Path("scripts/pilot-cross-table-anon-acl-readonly.sql").read_text()
assert re.search(r"(?im)^BEGIN TRANSACTION READ ONLY;",sql)
assert sql.strip().endswith("ROLLBACK;")
tables=("listings","profiles","account_students","conversations","messages","favorites",
        "saved_searches","listing_photos","user_roles","schools","reports","support_tickets")
for table in tables:
    assert "('"+table+"'," in sql, "missing protected table: "+table
for op in ("SELECT","INSERT","UPDATE","DELETE"):
    assert "has_table_privilege('anon',c.oid,'"+op+"')" in sql
for token in ("relrowsecurity","anon_applicable_select_policies","anon_applicable_write_policies",
              "NO_GO_MISSING_RLS","NO_GO_LISTINGS_ANON_SELECT","NO_GO_PRIVATE_TABLE_ANON_GRANT",
              "REVIEW_ANON_SELECT_RLS_POLICY","REVIEW_ANON_WRITE_RLS_POLICY",
              "CATALOG_PASS_NEEDS_E2E"):
    assert token in sql, "missing fail-closed audit token: "+token
server_only=("marketplace_alert_outbox","marketplace_postal_centroids","school_directory",
 "school_impact_report_deliveries","school_impact_report_subscriptions","super_admin_report_subscriptions")
for table in server_only:
    assert "('"+table+"')" in sql, "missing private server-only table "+table
for token in ("PASS_SERVER_ONLY_NO_POLICIES","NO_GO_SERVER_ONLY_GRANT_OR_POLICY_DRIFT",
              "has_table_privilege('authenticated',c.oid,'SELECT')",
              "has_table_privilege('service_role',c.oid,'SELECT')"):
    assert token in sql
clean="\n".join(line.split("--")[0] for line in sql.splitlines())
assert not re.search(r"(?im)^\s*(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|GRANT|REVOKE|TRUNCATE)\b",clean)
print("PASS: 12-table ACL/RLS audit + 6 server-only table grants, metadata only")
