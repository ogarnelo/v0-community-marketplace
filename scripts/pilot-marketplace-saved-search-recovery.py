#!/usr/bin/env python3
"""Production-shaped SYNTHETIC saved-search/postcode cold-restore exercise.

Only connects to the workflow's disposable 127.0.0.1 PostgreSQL17 source.
No real users, real coordinates, production Storage, Resend or hosted Auth.
"""
import hashlib
import os
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

SOURCE = os.environ.get("LOCAL_RESTORE_URL", "")
parsed = urlsplit(SOURCE)
if (parsed.scheme not in ("postgres", "postgresql")
        or parsed.hostname not in ("localhost", "127.0.0.1", "::1")
        or parsed.path != "/wetudy_pilot_dr_source"):
    raise SystemExit("Refusing nonlocal synthetic PostgreSQL source")
TARGET = urlunsplit((parsed.scheme, parsed.netloc,
                     "/wetudy_pilot_nearby_restored", "", ""))
A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
SCHEMAS = ("qa_near_auth", "qa_near_market")
TABLES = (
    "users", "listings", "user_marketplace_preferences", "marketplace_postal_centroids",
    "saved_searches", "saved_search_matches", "marketplace_alert_outbox",
    "transactional_email_deliveries",
)

SQL = """
create schema qa_near_auth;
create schema qa_near_market;
create table qa_near_auth.users(id uuid primary key, email text not null);
create table qa_near_market.listings(
  id uuid primary key, seller_id uuid not null references qa_near_auth.users(id),
  postal_code text not null, title text not null);
create table qa_near_market.user_marketplace_preferences(
  user_id uuid primary key references qa_near_auth.users(id),
  postal_code text, city text);
create table qa_near_market.marketplace_postal_centroids(
  postal_code text primary key, latitude double precision not null,
  longitude double precision not null);
create table qa_near_market.saved_searches(
  id uuid primary key, user_id uuid not null references qa_near_auth.users(id),
  name text not null, radius_km integer, email_enabled boolean not null);
create table qa_near_market.saved_search_matches(
  id uuid primary key, saved_search_id uuid not null references qa_near_market.saved_searches(id),
  listing_id uuid not null references qa_near_market.listings(id),
  user_id uuid not null references qa_near_auth.users(id),
  emailed_at timestamptz);
create table qa_near_market.marketplace_alert_outbox(
  listing_id uuid primary key references qa_near_market.listings(id),
  state text not null, attempts integer not null, lease_token uuid,
  lease_until timestamptz, expires_at timestamptz not null);
create table qa_near_market.transactional_email_deliveries(
  event_key text primary key, provider_message_id text, sent_at timestamptz not null);

insert into qa_near_auth.users values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','family-a@example.invalid'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','family-b@example.invalid');
insert into qa_near_market.marketplace_postal_centroids values
 ('28013',40.42,-3.70),('28014',40.41,-3.69);
insert into qa_near_market.user_marketplace_preferences values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','28013','Synthetic City'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','28014','Synthetic City');
insert into qa_near_market.listings values
 ('11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','28013','Synthetic maths book'),
 ('22222222-2222-4222-8222-222222222222',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','28014','Synthetic uniform');
insert into qa_near_market.saved_searches values
 ('33333333-3333-4333-8333-333333333333',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Maths nearby',10,true);
insert into qa_near_market.saved_search_matches values
 ('44444444-4444-4444-8444-444444444444',
 '33333333-3333-4333-8333-333333333333',
 '11111111-1111-4111-8111-111111111111',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-11-10T12:00:00Z');
insert into qa_near_market.marketplace_alert_outbox values
 ('11111111-1111-4111-8111-111111111111','completed',1,null,null,
  '2026-11-12T12:00:00Z');
insert into qa_near_market.transactional_email_deliveries values
 ('saved-search-match/synthetic-test','synthetic-provider-receipt',
 '2026-11-10T12:00:00Z');
"""

def run(*args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=90)
    if result.returncode:
        raise RuntimeError(args[0] + " failed in isolated restore")
    return result.stdout.strip()

def sql(conn, command):
    return run("psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
               "--dbname", conn, "-c", command)

def snapshot(conn):
    out = {}
    for table in TABLES:
        schema = "qa_near_auth" if table == "users" else "qa_near_market"
        out[table] = sql(conn,
            "select count(*)::text || ':' || "
            "coalesce(md5(string_agg(payload, ',' order by payload)),md5('')) "
            "from (select to_jsonb(t)::text as payload from "
            + schema + "." + table + " as t) q")
    return out

def verify(conn):
    verified = sql(conn, """
    select count(*) from qa_near_market.saved_search_matches m
    join qa_near_market.saved_searches s on s.id=m.saved_search_id
    join qa_near_market.listings l on l.id=m.listing_id
    join qa_near_market.user_marketplace_preferences prefs on prefs.user_id=s.user_id
    join qa_near_market.marketplace_postal_centroids cp1 on cp1.postal_code=prefs.postal_code
    join qa_near_market.marketplace_postal_centroids cp2 on cp2.postal_code=l.postal_code
    join qa_near_market.marketplace_alert_outbox o on o.listing_id=l.id
    join qa_near_market.transactional_email_deliveries d
      on d.event_key='saved-search-match/synthetic-test'
    where m.user_id=s.user_id and m.user_id<>l.seller_id
      and s.email_enabled and s.radius_km=10
      and cp1.latitude between -90 and 90
      and cp2.longitude between -180 and 180
      and o.state='completed'
      and m.emailed_at is not null and d.provider_message_id is not null
    """)
    if verified != "1":
        raise AssertionError("Recovered saved search/postcode/receipt chain is inconsistent")

def main():
    sql(SOURCE,SQL)
    original=snapshot(SOURCE)
    verify(SOURCE)
    with tempfile.TemporaryDirectory(prefix="wetudy-qa-nearby-") as directory:
        archive=Path(directory)/"synthetic-nearby.dump"
        run("pg_dump","--dbname",SOURCE,"-Fc","--no-owner","--no-acl",
            "--schema=qa_near_auth","--schema=qa_near_market","-f",str(archive))
        if archive.stat().st_size < 1024:
            raise AssertionError("Unexpectedly empty synthetic archive")
        if sql(SOURCE,"select count(*) from pg_database where datname='wetudy_pilot_nearby_restored'")!="0":
            raise AssertionError("Refusing to overwrite an existing database")
        sql(SOURCE,"create database wetudy_pilot_nearby_restored")
        try:
            run("pg_restore","--exit-on-error","--no-owner","--no-acl",
                "--dbname",TARGET,str(archive))
            if snapshot(TARGET)!=original:
                raise AssertionError("Recovered saved-search rows differ")
            verify(TARGET)
            adversarial=[
                ("postcode mismatch",
                 "update qa_near_market.user_marketplace_preferences set postal_code='99999' where user_id='"+
                 B+"'", "update qa_near_market.user_marketplace_preferences set postal_code='28014' where user_id='"+B+"'"),
                ("match owner mismatch",
                 "update qa_near_market.saved_search_matches set user_id='"+A+"'",
                 "update qa_near_market.saved_search_matches set user_id='"+B+"'"),
                ("missing receipt",
                 "update qa_near_market.transactional_email_deliveries set provider_message_id=null",
                 "update qa_near_market.transactional_email_deliveries set provider_message_id='synthetic-provider-receipt'"),
                ("incomplete alert",
                 "update qa_near_market.marketplace_alert_outbox set state='failed'",
                 "update qa_near_market.marketplace_alert_outbox set state='completed'"),
                ("unsent match",
                 "update qa_near_market.saved_search_matches set emailed_at=null",
                 "update qa_near_market.saved_search_matches set emailed_at='2026-11-10T12:00:00Z'"),
            ]
            for label,attack,reset in adversarial:
                sql(TARGET,attack)
                try:
                    verify(TARGET)
                except AssertionError:
                    pass
                else:
                    raise AssertionError("Tampered recovery was not detected: "+label)
                finally:
                    sql(TARGET,reset)
                verify(TARGET)
            if snapshot(TARGET)!=original:
                raise AssertionError("Synthetic restored data changed after tamper tests")
            print("PASS synthetic saved-search/postcode/outbox/receipt restore and five adversarial checks.")
            print("LIMIT: invented data and simplified schema, NOT real Auth/Storage or full production DR.")
        finally:
            sql(SOURCE,"drop database if exists wetudy_pilot_nearby_restored with (force)")

if __name__=="__main__":
    main()
