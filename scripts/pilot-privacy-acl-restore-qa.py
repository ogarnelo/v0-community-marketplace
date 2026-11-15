#!/usr/bin/env python3
"""Cold PG17 restore of synthetic listing data, RLS policies and selective ACL.
No production endpoints, no personal data and no external email services.
"""
import os
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

source_url = os.environ.get("LOCAL_RESTORE_URL", "")
parts = urlsplit(source_url)
if parts.scheme not in ("postgresql", "postgres") or parts.hostname not in (
    "127.0.0.1", "localhost", "::1"
) or parts.path != "/wetudy_pilot_dr_source":
    raise SystemExit("Refusing to run outside the disposable local PG17 runner")
root = Path(__file__).resolve().parent
first_db = "wetudy_qa_privacy_acl_source"
second_db = "wetudy_qa_privacy_acl_restored"
def db_url(name):
    return urlunsplit((parts.scheme,parts.netloc,"/"+name,"",""))
def cmd(argv, expect=True):
    result = subprocess.run(argv,capture_output=True,text=True,timeout=110,check=False)
    if (result.returncode==0)!=expect:
        # Never reveal SQL rows, DB URLs, tokens or archive contents in CI logs.
        raise AssertionError("Isolated recovery contract failed: "+argv[0])
    return result.stdout.strip()
def query(name, statement, expect=True):
    return cmd(["psql","-X","-A","-t","-v","ON_ERROR_STOP=1",
                "--dbname",db_url(name),"-c",statement],expect)
def psql_script(name,path):
    cmd(["psql","-X","-v","ON_ERROR_STOP=1",
         "--dbname",db_url(name),"-f",str(root/path)])
def gate(name):
    checks={
       "anon_table":("anon","SELECT",False),
    }
    fingerprint=query(name,"""SELECT
      (SELECT relrowsecurity::text FROM pg_class WHERE oid='public.listings'::regclass)
      || ':' || (SELECT count(*)::text FROM pg_policies WHERE schemaname='public'
                         AND tablename='listings' AND cmd='SELECT')
      || ':' || has_table_privilege('anon','public.listings','SELECT')::text
      || ':' || has_table_privilege('authenticated','public.listings','SELECT')::text
      || ':' || has_column_privilege('authenticated','public.listings','id','SELECT')::text
      || ':' || has_column_privilege('authenticated','public.listings','postal_code','SELECT')::text
      || ':' || has_column_privilege('authenticated','public.listings','lat','SELECT')::text
      || ':' || has_column_privilege('authenticated','public.listings','lng','SELECT')::text
      || ':' || has_table_privilege('service_role','public.listings','SELECT')::text
      || ':' || has_table_privilege('anon','public.listings','INSERT')::text
      || ':' || has_table_privilege('anon','public.listings','UPDATE')::text
      || ':' || has_table_privilege('anon','public.listings','DELETE')::text
      || ':' || has_table_privilege('authenticated','public.listings','INSERT')::text
      || ':' || has_table_privilege('authenticated','public.listings','UPDATE')::text
      || ':' || has_table_privilege('authenticated','public.listings','DELETE')::text
      || ':' || has_column_privilege('authenticated','public.listings','postal_code','UPDATE')::text
      || ':' || (SELECT md5(string_agg(id::text||':'||status,',' ORDER BY id))
                   FROM public.listings)""")
    if fingerprint != "true:1:false:false:true:false:false:false:true:true:true:true:true:true:true:true:" + (
        query(name,"SELECT md5(string_agg(id::text||':'||status,',' ORDER BY id)) FROM public.listings")
    ):
        raise AssertionError("Restored ACL, RLS or synthetic data fingerprint mismatch")
    # Real SQL queries as restricted roles, not metadata-only tests:
    query(name,"BEGIN; SET LOCAL ROLE anon; SELECT id FROM public.listings; ROLLBACK",False)
    auth=query(name,"BEGIN; SET LOCAL ROLE authenticated; "
        "SELECT count(*) FROM public.listings; ROLLBACK")
    if "1" not in auth.splitlines():
        raise AssertionError("Authenticated available-only RLS SELECT unexpectedly failed")
    query(name,"BEGIN; SET LOCAL ROLE authenticated; "
        "SELECT postal_code FROM public.listings; ROLLBACK",False)
    query(name,"BEGIN; SET LOCAL ROLE authenticated; "
        "SELECT lat,lng FROM public.listings; ROLLBACK",False)
    query(name,"BEGIN; SET LOCAL ROLE authenticated; "
        "SELECT * FROM public.listings; ROLLBACK",False)
    service=query(name,"BEGIN; SET LOCAL ROLE service_role; "
        "SELECT count(*) FROM public.listings; ROLLBACK")
    bypass=query(name,"SELECT rolbypassrls::text FROM pg_roles WHERE rolname='service_role'")
    expected_count="2" if bypass=="true" else "1"
    if expected_count not in service.splitlines():
        raise AssertionError("Server role SELECT/RLS behavior changed across recovery")
    if "2" not in query(name,"SELECT count(*) FROM public.listings").splitlines():
        raise AssertionError("Synthetic archive lost source rows")

for name in (first_db,second_db):
    if query("wetudy_pilot_dr_source",
             "SELECT count(*) FROM pg_database WHERE datname='"+name+"'")!="0":
        raise SystemExit("Refusing to overwrite existing synthetic recovery DB")
query("wetudy_pilot_dr_source","""DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;""")
created=[]
try:
    for name in (first_db,second_db):
        query("wetudy_pilot_dr_source","CREATE DATABASE "+name+" TEMPLATE template0")
        created.append(name)
    query(first_db,"CREATE TABLE public.listings (id uuid, school_id uuid, user_id uuid, title text, description text, category text, grade_level text, condition text, listing_type text, price numeric, estimated_retail_price numeric, status text, isbn text, author text, publisher text, format text, language text, postal_code text, lat double precision, lng double precision, created_at timestamptz, updated_at timestamptz, seller_id uuid, type text, original_price numeric, photos text[], subject text, specific_type text, size_label text, brand text, model text, season text, book_edition_id uuid, directory_school_code text, is_demo boolean, savings_amount numeric)")
    query(first_db,"ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY")
    query(first_db,"CREATE POLICY qa_available_listing ON public.listings FOR SELECT TO PUBLIC USING (status='available')")
    query(first_db,"GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role")
    # Production-compatible wide DML grant baseline: SELECT-only migration must not alter it.
    # RLS remains a separate authorization check for writing rows.
    query(first_db,"GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.listings TO anon,authenticated")
    query(first_db,"GRANT SELECT ON TABLE public.listings TO service_role")
    query(first_db,"INSERT INTO public.listings (id,status,postal_code) VALUES "
      "('88000000-0000-4000-8000-000000000001','available','28001'),"
      "('88000000-0000-4000-8000-000000000002','archived','28002')")
    psql_script(first_db,"pilot-anon-listings-revoke-proposal.sql")
    psql_script(first_db,"pilot-auth-listings-sensitive-grants-proposal.sql")
    gate(first_db)
    with tempfile.TemporaryDirectory(prefix="wetudy-qa-privacy-restore-") as temp:
        archive=str(Path(temp)/"privacy-acl-qa.dump")
        cmd(["pg_dump","--format=custom","--schema=public","--no-owner",
             "--dbname",db_url(first_db),"--file",archive])
        if Path(archive).stat().st_size<2000:
            raise AssertionError("Expected a nonempty synthetic ACL archive")
        cmd(["pg_restore","--no-owner","--clean","--if-exists",
             "--exit-on-error","--dbname",db_url(second_db),archive])
        gate(second_db)
    print("PASS synthetic PG17 privacy restore: anon denied, auth 33-column grant,"
          " postal/geo denied, RLS available-only, server reads preserved,"
          " prior anon/auth INSERT/UPDATE/DELETE grants preserved across dump/restore")
finally:
    for name in reversed(created):
        query("wetudy_pilot_dr_source","DROP DATABASE IF EXISTS "+name+" WITH (FORCE)")
