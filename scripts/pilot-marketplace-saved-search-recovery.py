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

-- Synthetic role only, not a real Supabase authenticated session.
create role qa_near_family nologin;
grant usage on schema qa_near_market to qa_near_family;
grant select on qa_near_market.user_marketplace_preferences,
                qa_near_market.saved_searches,
                qa_near_market.saved_search_matches to qa_near_family;
-- Exercise writes with a least-privilege synthetic family role: recipients may
-- update only their own criteria, not the system-maintained match ledger.
grant update(postal_code) on qa_near_market.user_marketplace_preferences to qa_near_family;
grant update(radius_km) on qa_near_market.saved_searches to qa_near_family;
grant insert(id,user_id,name,radius_km,email_enabled)
  on qa_near_market.saved_searches to qa_near_family;
alter table qa_near_market.user_marketplace_preferences enable row level security;
alter table qa_near_market.saved_searches enable row level security;
alter table qa_near_market.saved_search_matches enable row level security;
create policy own_preferences on qa_near_market.user_marketplace_preferences
 for select to qa_near_family
 using(user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
create policy own_searches on qa_near_market.saved_searches
 for select to qa_near_family
 using(user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
create policy own_matches on qa_near_market.saved_search_matches
 for select to qa_near_family
 using(user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
create policy update_own_preferences on qa_near_market.user_marketplace_preferences
 for update to qa_near_family
 using(user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)
 with check(user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
create policy update_own_searches on qa_near_market.saved_searches
 for update to qa_near_family
 using(user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)
 with check(user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
create policy create_own_searches on qa_near_market.saved_searches
 for insert to qa_near_family
 with check(user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
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

def verify_restored_family_isolation(conn):
    """RLS checks under a reduced synthetic DB role with a simulated claim."""
    expected={A:"0:0:1",B:"1:1:1"}
    for principal,counts in [*expected.items(),("cccccccc-cccc-4ccc-8ccc-cccccccccccc","0:0:0")]:
        statement = (
            "begin; set local role qa_near_family; "
            "select set_config('request.jwt.claim.sub','"+principal+"',true); "
            "select (select count(*) from qa_near_market.saved_searches)::text||':'||"
            "(select count(*) from qa_near_market.saved_search_matches)::text||':'||"
            "(select count(*) from qa_near_market.user_marketplace_preferences)::text; "
            "rollback;"
        )
        result=sql(conn,statement).splitlines()
        if counts not in result:
            raise AssertionError("Restored family isolation failed for synthetic account")
    for name in ("saved_searches","saved_search_matches","user_marketplace_preferences"):
        guarded=sql(conn,
            "select c.relrowsecurity::text||':'||"
            "has_table_privilege('qa_near_family','qa_near_market."+name+"','SELECT')::text "
            "from pg_class c join pg_namespace n on n.oid=c.relnamespace "
            "where n.nspname='qa_near_market' and c.relname='"+name+"'")
        if guarded!="true:true":
            raise AssertionError("Missing RLS or synthetic role SELECT grant on "+name)


def verify_restored_family_write_isolation(conn):
    """Prove owner writes work, cross-account writes fail, no state persists."""
    before = snapshot(conn)
    # Read/write transactions are rolled back; these tests cannot alter the
    # synthetic restored state or invalidate the earlier ciphertext checksum.
    allowed = sql(conn,
        "begin; set local role qa_near_family; "
        "select set_config('request.jwt.claim.sub','"+B+"',true); "
        "update qa_near_market.saved_searches set radius_km=25 "
        "where user_id='"+B+"' returning radius_km; rollback;").splitlines()
    if "25" not in allowed:
        raise AssertionError("Synthetic owner cannot update own search radius")

    denied_update = sql(conn,
        "begin; set local role qa_near_family; "
        "select set_config('request.jwt.claim.sub','"+A+"',true); "
        "update qa_near_market.saved_searches set radius_km=500 "
        "where user_id='"+B+"' returning id; rollback;").splitlines()
    if any(line == "33333333-3333-4333-8333-333333333333" for line in denied_update):
        raise AssertionError("Cross-family update bypassed restored RLS")
    if "UPDATE 0" not in denied_update:
        raise AssertionError("Cross-family update was not blocked by restored RLS")

    allowed_postcode = sql(conn,
        "begin; set local role qa_near_family; "
        "select set_config('request.jwt.claim.sub','"+A+"',true); "
        "update qa_near_market.user_marketplace_preferences "
        "set postal_code='28014' where user_id='"+A+"' returning postal_code; rollback;").splitlines()
    if "28014" not in allowed_postcode:
        raise AssertionError("Synthetic owner cannot change own postcode")

    for principal, target_user in ((A, B), (B, A)):
        rejected_postcode = sql(conn,
            "begin; set local role qa_near_family; "
            "select set_config('request.jwt.claim.sub','"+principal+"',true); "
            "update qa_near_market.user_marketplace_preferences "
            "set postal_code='00000' where user_id='"+target_user+"' returning user_id; rollback;").splitlines()
        if "UPDATE 0" not in rejected_postcode:
            raise AssertionError("Cross-family postcode update was not blocked")

    # A family can create a saved search only under its own user_id.
    accepted = sql(conn,
        "begin; set local role qa_near_family; "
        "select set_config('request.jwt.claim.sub','"+A+"',true); "
        "insert into qa_near_market.saved_searches "
        "(id,user_id,name,radius_km,email_enabled) values "
        "('55555555-5555-4555-8555-555555555555','"+A+"','QA new search',5,false) "
        "returning user_id; rollback;").splitlines()
    if A not in accepted:
        raise AssertionError("Family could not create own saved search")

    # FOR INSERT ... WITH CHECK must reject an identity spoof.
    hostile = (
        "begin; set local role qa_near_family; "
        "select set_config('request.jwt.claim.sub','"+A+"',true); "
        "insert into qa_near_market.saved_searches "
        "(id,user_id,name,radius_km,email_enabled) values "
        "('66666666-6666-4666-8666-666666666666','"+B+"','QA hostile',5,false); rollback;"
    )
    command = subprocess.run(
        ["psql","-X","-v","ON_ERROR_STOP=1","--dbname",conn,"-c",hostile],
        capture_output=True,text=True,timeout=20)
    if command.returncode == 0 or "row-level security policy" not in command.stderr:
        raise AssertionError("RLS failed to reject another family's saved-search INSERT")

    # The system-owned match ledger has no write access for family clients.
    for name in ("saved_search_matches", "marketplace_alert_outbox",
                 "transactional_email_deliveries"):
        privilege = sql(conn,
            "select has_table_privilege('qa_near_family','qa_near_market."
            + name + "','INSERT')::text || ':' || "
            "has_table_privilege('qa_near_family','qa_near_market."
            + name + "','UPDATE')::text")
        if privilege != "false:false":
            raise AssertionError("Family can mutate protected alert/delivery state: "+name)

    if snapshot(conn) != before:
        raise AssertionError("Synthetic RLS write tests changed restored rows")


def main():
    sql(SOURCE,SQL)
    verify_restored_family_isolation(SOURCE)
    verify_restored_family_write_isolation(SOURCE)
    original=snapshot(SOURCE)
    verify(SOURCE)
    with tempfile.TemporaryDirectory(prefix="wetudy-qa-nearby-") as directory:
        archive=Path(directory)/"synthetic-nearby.dump"
        run("pg_dump","--dbname",SOURCE,"-Fc","--no-owner",
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
            # PostgreSQL scoped dumps may not recreate a schema-level USAGE
            # grant for roles existing globally in the disposable cluster.
            # Detect the gap, then explicitly replay the minimal synthetic
            # schema access grant. Never copy this step to hosted Supabase.
            if sql(TARGET,
                   "select has_schema_privilege('qa_near_family','qa_near_market','USAGE')") != "t":
                sql(TARGET,"grant usage on schema qa_near_market to qa_near_family")
            if sql(TARGET,
                   "select has_schema_privilege('qa_near_family','qa_near_market','USAGE')") != "t":
                raise AssertionError("Restored synthetic schema USAGE grant missing")
            verify(TARGET)
            # A filtered logical dump may omit table ACLs too. Replay only
            # read grants for this synthetic QA role, then enforce RLS.
            sql(TARGET,
                "grant select on qa_near_market.user_marketplace_preferences,"
                " qa_near_market.saved_searches,"
                " qa_near_market.saved_search_matches to qa_near_family")
            sql(TARGET,
                "grant update(postal_code) on qa_near_market.user_marketplace_preferences "
                "to qa_near_family")
            sql(TARGET,
                "grant update(radius_km) on qa_near_market.saved_searches to qa_near_family")
            sql(TARGET,
                "grant insert(id,user_id,name,radius_km,email_enabled) on "
                "qa_near_market.saved_searches to qa_near_family")
            verify_restored_family_isolation(TARGET)
            verify_restored_family_write_isolation(TARGET)
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
            print("PASS synthetic saved-search/postcode/outbox/receipt restore, five adversarial checks and restored read/write family RLS.")
            print("LIMIT: invented data and simplified schema, NOT real Auth/Storage or full production DR.")
        finally:
            sql(SOURCE,"drop database if exists wetudy_pilot_nearby_restored with (force)")

if __name__=="__main__":
    main()
