#!/usr/bin/env python3
"""Offline contract for Wetudy's disaster-recovery scope.

Inventory: production Supabase information_schema.tables (SELECT only),
collected 2026-11-09. No production credentials or runtime calls here.
A successful synthetic six-table restore is NOT a full Wetudy recovery.
"""
import ast
import json
from pathlib import Path
import sys

PUBLIC_TABLES = set("""
account_students agreement_events agreement_reviews agreements automation_runs
autopilot_recommendations book_editions business_metrics_snapshots commerce_refunds
commerce_transfers conversation_outcome_feedback conversations conversion_nudges
course_materials course_needs demand_campaigns demand_events demand_match_notifications
demand_opportunity_actions demand_requests donation_request_events donation_requests
favorites growth_acquisition_events hidden_conversations inventory_expansion_events
listing_boosts listing_drafts listing_offer_events listing_offers listing_packs
listing_photos listing_signals listing_views listings marketplace_events
marketplace_search_events messages moderation_flags notifications payment_events
payment_intents payment_shipping_sandbox_runs profiles referrals reports
resend_webhook_events resend_webhook_secrets reviews saved_search_matches
saved_searches school_access_codes school_admins school_codes school_directory
school_impact_report_deliveries school_impact_report_subscriptions
school_registration_requests schools seller_connect_accounts seller_publish_templates
seller_velocity_events seo_programmatic_pages shipment_events shipments
super_admin_report_subscriptions support_tickets transaction_issues transaction_reviews
transaction_velocity_events transactional_email_deliveries
transactional_email_health_alert_states transactional_email_health_daily_snapshots
transactional_email_recipient_health user_follows user_marketplace_preferences
user_roles
""".split())
CRITICAL = {
    "families": {"profiles", "account_students", "schools", "school_directory", "user_roles"},
    "listings": {"listings", "listing_photos", "listing_drafts", "listing_offers"},
    "messages": {"conversations", "messages", "notifications"},
    "transactions": {"agreements", "payment_intents", "payment_events", "shipments"},
}
REPO = Path(__file__).resolve().parents[1]
def covered_tables():
    code = (REPO / "scripts/pilot-full-local-db-clone-recovery.py").read_text()
    module = ast.parse(code)
    for element in module.body:
        if isinstance(element, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "TABLES"
            for target in element.targets):
            return set(ast.literal_eval(element.value))
    raise AssertionError("Local restore fixture TABLES inventory missing")

def main():
    covered = covered_tables()
    assert len(PUBLIC_TABLES) == 77, f"Expected verified inventory of 77, got {len(PUBLIC_TABLES)}"
    assert covered <= PUBLIC_TABLES, "Restore fixture has unknown production table name"
    assert len(covered) >= 6, "Local restore contract lost protected tables"
    missing = PUBLIC_TABLES - covered
    findings = {area:sorted(tables-covered) for area,tables in CRITICAL.items()}
    result = {
        "inventory_as_of": "2026-11-09",
        "total_public_tables":len(PUBLIC_TABLES),
        "tested_local_public_tables":len(covered),
        "untested_public_tables":len(missing),
        "missing_by_critical_workflow":findings,
        "additional_required_components":[
            "GoTrue Auth runtime, users, identities and configuration",
            "Storage physical private object bytes and policies",
            "secrets, SMTP, keys, functions and external integrations"
        ],
        "ready_for_full_production_restore": False
    }
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if "--require-full-coverage" in sys.argv:
        if missing or any(findings.values()):
            print("BLOCKED: synthetic local DB restore is NOT a full production disaster-recovery drill",
                  file=sys.stderr)
            return 2
        # All public tables alone are still insufficient for GoTrue/Storage.
        print("BLOCKED: app tables alone do not prove Auth/Storage runtime recovery",
              file=sys.stderr)
        return 2
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
