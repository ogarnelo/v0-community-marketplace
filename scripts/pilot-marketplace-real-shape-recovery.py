#!/usr/bin/env python3
"""Recover a PRODUCTION-SHAPED synthetic Wetudy sale chain in isolated PostgreSQL.

The subset of column names, types and relationships below was inspected using
READ-ONLY production information_schema/pg_constraint on 2026-11-09.
All rows and files in this exercise are invented. This is NOT a complete
production schema, Stripe transaction, hosted Storage or GoTrue restore.
"""
import hashlib
import os
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

SOURCE=os.environ.get("LOCAL_RESTORE_URL","")
parsed=urlsplit(SOURCE)
if (parsed.scheme not in ("postgresql","postgres") or
    parsed.hostname not in ("127.0.0.1","localhost","::1") or
    parsed.path != "/wetudy_pilot_dr_source"):
    raise SystemExit("Refusing nonlocal or unexpected PostgreSQL source")
TARGET=urlunsplit((parsed.scheme,parsed.netloc,"/wetudy_pilot_real_shape_restored","",""))
SCHEMAS=("qa_real_auth","qa_real_market")
SELLER="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
BUYER="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

def run(*args):
    result=subprocess.run(args,capture_output=True,text=True,timeout=100)
    if result.returncode:
        errors=[line.strip() for line in result.stderr.splitlines()
                if "ERROR:" in line or "pg_restore: error:" in line]
        raise RuntimeError(args[0]+" failed: "+" | ".join(errors[:2])[:420])
    return result.stdout.strip()

def sql(conn,query):
    return run("psql","-X","-A","-t","-v","ON_ERROR_STOP=1",
               "--dbname",conn,"-c",query)

SCHEMA="""
CREATE SCHEMA qa_real_auth;
CREATE SCHEMA qa_real_market;
CREATE TABLE qa_real_auth.users (id uuid PRIMARY KEY, email text NOT NULL);
CREATE TABLE qa_real_market.profiles (
 id uuid PRIMARY KEY REFERENCES qa_real_auth.users(id));
CREATE TABLE qa_real_market.listings (
 id uuid PRIMARY KEY, user_id uuid REFERENCES qa_real_market.profiles(id),
 seller_id uuid REFERENCES qa_real_auth.users(id),
 title text NOT NULL, listing_type text NOT NULL,
 status text, price numeric, is_demo boolean);
CREATE TABLE qa_real_market.listing_photos (
 id uuid PRIMARY KEY, listing_id uuid REFERENCES qa_real_market.listings(id)
 ON DELETE CASCADE, url text NOT NULL, sort_order integer);
CREATE TABLE qa_real_market.conversations (
 id uuid PRIMARY KEY, listing_id uuid REFERENCES qa_real_market.listings(id)
 ON DELETE CASCADE, buyer_id uuid REFERENCES qa_real_market.profiles(id),
 seller_id uuid REFERENCES qa_real_market.profiles(id));
CREATE TABLE qa_real_market.messages (
 id uuid PRIMARY KEY, conversation_id uuid REFERENCES qa_real_market.conversations(id)
 ON DELETE CASCADE, sender_id uuid REFERENCES qa_real_market.profiles(id),
 body text, attachment_path text);
CREATE TABLE qa_real_market.listing_offers (
 id uuid PRIMARY KEY, listing_id uuid NOT NULL REFERENCES qa_real_market.listings(id)
 ON DELETE CASCADE, buyer_id uuid NOT NULL REFERENCES qa_real_market.profiles(id),
 seller_id uuid NOT NULL REFERENCES qa_real_market.profiles(id),
 offered_price numeric NOT NULL, status text);
CREATE TABLE qa_real_market.agreements (
 id uuid PRIMARY KEY, listing_id uuid NOT NULL REFERENCES qa_real_market.listings(id)
 ON DELETE CASCADE, conversation_id uuid REFERENCES qa_real_market.conversations(id)
 ON DELETE SET NULL, buyer_id uuid NOT NULL REFERENCES qa_real_auth.users(id)
 ON DELETE CASCADE, seller_id uuid NOT NULL REFERENCES qa_real_auth.users(id)
 ON DELETE CASCADE, agreement_type text NOT NULL,
 status text NOT NULL, amount numeric, currency text NOT NULL);
CREATE TABLE qa_real_market.payment_intents (
 id uuid PRIMARY KEY, listing_id uuid NOT NULL REFERENCES qa_real_market.listings(id)
 ON DELETE CASCADE, conversation_id uuid REFERENCES qa_real_market.conversations(id)
 ON DELETE SET NULL, offer_id uuid REFERENCES qa_real_market.listing_offers(id)
 ON DELETE SET NULL, buyer_id uuid NOT NULL REFERENCES qa_real_market.profiles(id),
 seller_id uuid NOT NULL REFERENCES qa_real_market.profiles(id),
 amount numeric NOT NULL, currency text NOT NULL,
 provider text NOT NULL, status text NOT NULL, metadata jsonb NOT NULL);
CREATE TABLE qa_real_market.payment_events (
 id uuid PRIMARY KEY,
 payment_intent_id uuid NOT NULL REFERENCES qa_real_market.payment_intents(id)
 ON DELETE CASCADE, event_type text NOT NULL, payload jsonb NOT NULL);
CREATE TABLE qa_real_market.shipments (
 id uuid PRIMARY KEY,
 payment_intent_id uuid REFERENCES qa_real_market.payment_intents(id) ON DELETE SET NULL,
 listing_id uuid NOT NULL REFERENCES qa_real_market.listings(id) ON DELETE CASCADE,
 conversation_id uuid REFERENCES qa_real_market.conversations(id) ON DELETE SET NULL,
 buyer_id uuid NOT NULL REFERENCES qa_real_market.profiles(id),
 seller_id uuid NOT NULL REFERENCES qa_real_market.profiles(id),
 provider text NOT NULL, status text NOT NULL, payload jsonb NOT NULL);
-- This is a LOCAL TEST-ONLY object byte store, not a production Storage table.
CREATE TABLE qa_real_market.object_bytes (
 bucket text NOT NULL, path text NOT NULL, owner_user_id uuid NOT NULL
 REFERENCES qa_real_market.profiles(id),
 content bytea NOT NULL, sha256 text NOT NULL,
 PRIMARY KEY(bucket,path));
INSERT INTO qa_real_auth.users VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','seller@example.invalid'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','buyer@example.invalid');
INSERT INTO qa_real_market.profiles VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO qa_real_market.listings VALUES
 ('11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'Libro ficticio QA','sale','reserved',15.00,true);
INSERT INTO qa_real_market.listing_photos VALUES
 ('22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111',
 'local://listing-photos/seller/example.webp',0);
INSERT INTO qa_real_market.conversations VALUES
 ('33333333-3333-4333-8333-333333333333',
 '11111111-1111-4111-8111-111111111111',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO qa_real_market.messages VALUES
 ('44444444-4444-4444-8444-444444444444',
 '33333333-3333-4333-8333-333333333333',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'Adjunto de prueba','buyer/receipt.txt');
INSERT INTO qa_real_market.listing_offers VALUES
 ('55555555-5555-4555-8555-555555555555',
 '11111111-1111-4111-8111-111111111111',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',15.00,'accepted');
INSERT INTO qa_real_market.agreements VALUES
 ('66666666-6666-4666-8666-666666666666',
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'sale','accepted',15.00,'EUR');
INSERT INTO qa_real_market.payment_intents VALUES
 ('77777777-7777-4777-8777-777777777777',
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '55555555-5555-4555-8555-555555555555',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 15.00,'EUR','qa-no-external-provider','synthetic', '{}'::jsonb);
INSERT INTO qa_real_market.payment_events VALUES
 ('88888888-8888-4888-8888-888888888888',
 '77777777-7777-4777-8777-777777777777','synthetic_confirmed',
 '{"qa":true}'::jsonb);
INSERT INTO qa_real_market.shipments VALUES
 ('99999999-9999-4999-8999-999999999999',
 '77777777-7777-4777-8777-777777777777',
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'qa-only','synthetic', '{"qa":true}'::jsonb);
"""
OBJECTS={
 ("listing-photos","seller/example.webp",SELLER):b"SYNTHETIC-WETUDY-IMAGE-NOT-A-PHOTO",
 ("chat-attachments","buyer/receipt.txt",BUYER):b"SYNTHETIC-WETUDY-ATTACHMENT-NOT-REAL",
}
TABLES=("profiles","listings","listing_photos","conversations","messages",
        "listing_offers","agreements","payment_intents","payment_events",
        "shipments","object_bytes")

def snapshot(conn):
    result={}
    for name in TABLES:
        result[name]=sql(conn, "SELECT count(*)::text || ':' || "
          "coalesce(md5(string_agg(row_text,',' ORDER BY row_text)),md5('')) "
          "FROM (SELECT to_jsonb(t)::text AS row_text "
          "FROM qa_real_market."+name+" t) AS contents")
    return result

def validate(conn):
    if sql(conn,"""SELECT count(*) FROM qa_real_market.agreements a
      JOIN qa_real_market.listings l ON l.id=a.listing_id
      JOIN qa_real_market.listing_offers o ON o.listing_id=l.id
      JOIN qa_real_market.conversations c ON c.id=a.conversation_id
      JOIN qa_real_market.payment_intents p ON p.offer_id=o.id
      JOIN qa_real_market.payment_events e ON e.payment_intent_id=p.id
      JOIN qa_real_market.shipments s ON s.payment_intent_id=p.id
      WHERE a.buyer_id=o.buyer_id AND a.seller_id=o.seller_id
      AND a.buyer_id=c.buyer_id AND a.seller_id=c.seller_id
      AND p.buyer_id=a.buyer_id AND p.seller_id=a.seller_id
      AND s.buyer_id=a.buyer_id AND s.seller_id=a.seller_id
      AND p.amount=a.amount AND o.offered_price=a.amount""")!="1":
        raise AssertionError("Recovered buyer/seller/offer/agreement/payment/shipment chain inconsistent")
    if sql(conn,"""SELECT count(*) FROM qa_real_market.listing_photos f
      JOIN qa_real_market.listings l ON l.id=f.listing_id
      JOIN qa_real_market.object_bytes b ON
        f.url='local://'||b.bucket||'/'||b.path
      WHERE b.owner_user_id=l.seller_id""")!="1":
        raise AssertionError("Listing photo file bytes or owner missing after restore")
    if sql(conn,"""SELECT count(*) FROM qa_real_market.messages m
      JOIN qa_real_market.object_bytes b ON m.attachment_path=b.path
      WHERE b.bucket='chat-attachments' AND b.owner_user_id=m.sender_id""")!="1":
        raise AssertionError("Chat attachment bytes or owner missing after restore")
    if sql(conn,"""SELECT count(*) FROM qa_real_market.object_bytes
      WHERE md5(content)=md5(content)""")!="2":
        raise AssertionError("Synthetic storage object bytes are missing")
    for (bucket,path,owner),data in OBJECTS.items():
        sha=hashlib.sha256(data).hexdigest()
        stored=sql(conn,"SELECT encode(content,'hex') || ':' || sha256 "
             "FROM qa_real_market.object_bytes WHERE bucket='"+bucket+
             "' AND path='"+path+"' AND owner_user_id='"+owner+"'")
        if stored != data.hex()+":"+sha:
            raise AssertionError("Restored object bytes or SHA256 mismatch")

def main():
    sql(SOURCE,SCHEMA)
    for (bucket,path,owner),data in OBJECTS.items():
        sql(SOURCE,"INSERT INTO qa_real_market.object_bytes VALUES ('"+
            bucket+"','"+path+"','"+owner+"',decode('"+data.hex()+
            "','hex'),'"+hashlib.sha256(data).hexdigest()+"')")
    original=snapshot(SOURCE)
    validate(SOURCE)
    with tempfile.TemporaryDirectory(prefix="wetudy-real-shape-dr-") as temp:
        archive=Path(temp)/"real-shape-qa.dump"
        run("pg_dump","--dbname",SOURCE,"-Fc","--no-owner","--no-acl",
            "--schema=qa_real_auth","--schema=qa_real_market","-f",str(archive))
        if archive.stat().st_size<4096:
            raise AssertionError("Unexpectedly empty local restore archive")
        if sql(SOURCE,"SELECT count(*) FROM pg_database "
                  "WHERE datname='wetudy_pilot_real_shape_restored'")!="0":
            raise AssertionError("Refusing to overwrite an existing local DB")
        sql(SOURCE,"CREATE DATABASE wetudy_pilot_real_shape_restored")
        try:
            run("pg_restore","--exit-on-error","--no-owner","--no-acl",
                "--dbname",TARGET,str(archive))
            if snapshot(TARGET)!=original:
                raise AssertionError("Recovered production-shaped table rows differ")
            validate(TARGET)
            # Deliberate rejection of an altered owner, without modifying source.
            sql(TARGET,"UPDATE qa_real_market.object_bytes SET owner_user_id='"+
                BUYER+"' WHERE bucket='listing-photos'")
            try:
                validate(TARGET)
            except AssertionError:
                pass
            else:
                raise AssertionError("Corrupt photo ownership was not caught")
            sql(TARGET,"UPDATE qa_real_market.object_bytes SET owner_user_id='"+
                SELLER+"' WHERE bucket='listing-photos'")
            validate(TARGET)
            print("PASS production-SHAPED local sale chain: listings, photos, "
                  "conversations, messages, offers, agreements, payment intents/events, "
                  "shipments, object bytes and owner continuity restored.")
            print("LIMIT: subset of original column names/FKs, synthetic rows and "
                  "payment/shipping providers; NOT full production DR or real GoTrue.")
        finally:
            sql(SOURCE,"DROP DATABASE IF EXISTS wetudy_pilot_real_shape_restored WITH (FORCE)")

if __name__=="__main__":
    main()
