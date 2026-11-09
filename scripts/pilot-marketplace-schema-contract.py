#!/usr/bin/env python3
"""Offline frozen contract for the production-SHAPED marketplace QA restore.

Source: read-only information_schema.columns and pg_constraint of hosted
Wetudy database, 2026-11-09. Contains NO user data, passwords or object bytes.
This tests essential selected production columns/FKs, NOT full schema equality.
"""
import ast
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
RESTORE=ROOT/"scripts"/"pilot-marketplace-real-shape-recovery.py"

# Core columns used in real Wetudy's commercial workflow, with actual types.
COLUMNS={
 "listings":{"user_id":"uuid","seller_id":"uuid","listing_type":"text",
             "status":"text","price":"numeric","is_demo":"boolean"},
 "listing_photos":{"listing_id":"uuid","url":"text"},
 "conversations":{"listing_id":"uuid","buyer_id":"uuid","seller_id":"uuid"},
 "messages":{"conversation_id":"uuid","sender_id":"uuid",
             "attachment_path":"text"},
 "listing_offers":{"listing_id":"uuid","buyer_id":"uuid",
                   "seller_id":"uuid","offered_price":"numeric"},
 "agreements":{"listing_id":"uuid","conversation_id":"uuid",
              "buyer_id":"uuid","seller_id":"uuid",
              "agreement_type":"text","amount":"numeric","currency":"text"},
 "payment_intents":{"listing_id":"uuid","conversation_id":"uuid",
                    "offer_id":"uuid","buyer_id":"uuid","seller_id":"uuid",
                    "amount":"numeric","metadata":"jsonb"},
 "payment_events":{"payment_intent_id":"uuid","event_type":"text","payload":"jsonb"},
 "shipments":{"listing_id":"uuid","payment_intent_id":"uuid",
              "buyer_id":"uuid","seller_id":"uuid","payload":"jsonb"},
}

# Production foreign key edges verified in pg_constraint, 2026-11-09.
# qa_real_auth.users stands in for auth.users; qa_real_market is only local.
REFERENCES={
 ("listings","seller_id"):("qa_real_auth","users"),
 ("listings","user_id"):("qa_real_market","profiles"),
 ("listing_photos","listing_id"):("qa_real_market","listings"),
 ("conversations","listing_id"):("qa_real_market","listings"),
 ("conversations","buyer_id"):("qa_real_market","profiles"),
 ("conversations","seller_id"):("qa_real_market","profiles"),
 ("messages","conversation_id"):("qa_real_market","conversations"),
 ("messages","sender_id"):("qa_real_market","profiles"),
 ("listing_offers","listing_id"):("qa_real_market","listings"),
 ("listing_offers","buyer_id"):("qa_real_market","profiles"),
 ("listing_offers","seller_id"):("qa_real_market","profiles"),
 ("agreements","listing_id"):("qa_real_market","listings"),
 ("agreements","buyer_id"):("qa_real_auth","users"),
 ("agreements","seller_id"):("qa_real_auth","users"),
 ("payment_intents","offer_id"):("qa_real_market","listing_offers"),
 ("payment_events","payment_intent_id"):("qa_real_market","payment_intents"),
 ("shipments","payment_intent_id"):("qa_real_market","payment_intents"),
}

def source_ddl():
    tree=ast.parse(RESTORE.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node,ast.Assign) and any(
            isinstance(t,ast.Name) and t.id=="SCHEMA" for t in node.targets):
            return ast.literal_eval(node.value)
    raise AssertionError("Production-shaped local restore SCHEMA missing")

def extract_table_blocks(ddl):
    pattern=re.compile(r"CREATE TABLE qa_real_market\.(\w+)\s*\((.*?)\);",re.S|re.I)
    return {table:content for table,content in pattern.findall(ddl)}

def check(ddl):
    tables=extract_table_blocks(ddl)
    errors=[]
    for table,columns in COLUMNS.items():
        body=tables.get(table,"")
        if not body:
            errors.append("Missing restored "+table+" table")
            continue
        for column,datatype in columns.items():
            # Column declarations can follow a comma on the same SQL line.
            if not re.search(r"(?:^|,)\s*"+re.escape(column)+r"\s+"+
                             re.escape(datatype)+r"\b",body,re.I):
                errors.append(table+"."+column+" is not "+datatype)
    for (table,column),(schema,target) in REFERENCES.items():
        body=tables.get(table,"")
        match=(r"(?m)^\s*"+re.escape(column)+r"\s+uuid\b[^,]*?\bREFERENCES\s+"+
               re.escape(schema)+r"\."+re.escape(target)+r"\(id\)")
        # Commas never occur inside these column declarations; FK is inline.
        if not re.search(match,body,re.I|re.S):
            errors.append("FK mismatch: "+table+"."+column+" -> "+schema+"."+target)
    # These two erroneous assumptions drove the earlier simplified test.
    if re.search(r"(?:^|,)\s*amount_cents\b",tables.get("listing_offers","")):
        errors.append("Synthetic amount_cents must not replace real offered_price")
    if re.search(r"(?:^|,)\s*offer_id\b",tables.get("agreements","")):
        errors.append("Production agreements has listing_id, not an offer_id field")
    return errors

def main():
    ddl=source_ddl()
    failures=check(ddl)
    if failures:
        raise AssertionError("Production-shape contract failed: "+"; ".join(failures))
    # Regression tests: ensure the guard DETECTS the older fake columns.
    if not check(ddl.replace("offered_price numeric","amount_cents integer",1)):
        raise AssertionError("Audit failed to detect obsolete offered_price mapping")
    if not check(ddl.replace("url text NOT NULL","image_path text NOT NULL",1)):
        raise AssertionError("Audit failed to detect missing listing_photos.url")
    if not check(ddl.replace("REFERENCES qa_real_auth.users(id)",
                             "REFERENCES qa_real_market.profiles(id)",1)):
        raise AssertionError("Audit failed to detect a changed owner FK")
    print(json.dumps({
        "checked_at":"2026-11-09",
        "source":"read-only production information_schema + pg_constraint",
        "tables_checked":len(COLUMNS),
        "columns_checked":sum(map(len,COLUMNS.values())),
        "foreign_keys_checked":len(REFERENCES),
        "regressions_detected":3,
        "scope":"selected production fields and essential edges, not full schema",
    },sort_keys=True))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
