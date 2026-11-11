#!/usr/bin/env python3
"""No-production SQL ACL test. Uses only disposable local PostgreSQL17."""
import os
import subprocess
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
uri=os.environ.get("LOCAL_RESTORE_URL","")
target=urlsplit(uri)
if (target.scheme not in ("postgres","postgresql")
    or target.hostname not in ("127.0.0.1","localhost","::1")
    or target.path != "/wetudy_pilot_dr_source"):
    raise SystemExit("Refusing nonlocal or non-disposable PostgreSQL")
source_uri=uri
fixture_db="wetudy_pilot_acl_privileges"
uri=urlunsplit((target.scheme,target.netloc,"/"+fixture_db,"",""))
root=Path(__file__).resolve().parent
def run(*args, succeeds=True):
    cp=subprocess.run(["psql","-X","-v","ON_ERROR_STOP=1","--dbname",uri,*args],
                      capture_output=True,text=True,timeout=45)
    if (cp.returncode==0)!=succeeds:
        raise AssertionError("Unexpected ACL/privilege gate result (no production SQL executed)")
    return cp.stdout.strip()
def check(table,role,privilege):
    return run("-t","-A","-c",
               "select has_table_privilege('"+role+"','public."+table+"','"+privilege+"')").strip()
tables=("saved_searches","saved_search_matches","user_marketplace_preferences")
roles=("anon","authenticated")
forbidden=("TRUNCATE","REFERENCES","TRIGGER","MAINTAIN")
allowed=("SELECT","INSERT","UPDATE","DELETE")
def source_query(query):
    cp=subprocess.run(["psql","-X","-A","-t","-v","ON_ERROR_STOP=1",
                       "--dbname",source_uri,"-c",query],
                      capture_output=True,text=True,timeout=40)
    if cp.returncode:
        raise RuntimeError("Disposable QA database operation failed")
    return cp.stdout.strip()

if source_query("select count(*) from pg_database where datname='"+fixture_db+"'")!="0":
    raise SystemExit("Refusing to overwrite pre-existing ACL fixture database")
source_query("create database "+fixture_db)
try:
    run("-f",str(root/"pilot-client-tablewide-privileges-regression.sql"))
    for table in tables:
        for role in roles:
            for p in forbidden+allowed:
                if check(table,role,p)!="t":
                    raise AssertionError("Fixture does not represent excess client privileges")
    preflight=str(root/"pilot-client-tablewide-privileges-preflight.sql")
    migration=str(root.parent/"supabase/migrations/20261111083000_marketplace_revoke_client_table_wide_privileges.sql")
    run("-f",preflight,succeeds=False)
    run("-f",migration)
    run("-f",preflight)
    for table in tables:
        for role in roles:
            for p in forbidden:
                if check(table,role,p)!="f":
                    raise AssertionError("Client still holds table-wide privilege")
            for p in allowed:
                if check(table,role,p)!="t":
                    raise AssertionError("Expected DML grant unexpectedly removed")
    # Re-apply migration to confirm idempotence and no destructive side effects.
    run("-f",migration)
    run("-f",preflight)
    # Simulate configuration drift and assert the read-only gate catches it.
    run("-c","grant truncate on public.saved_searches to authenticated")
    run("-f",preflight,succeeds=False)
    run("-f",migration)
    run("-f",preflight)
    print("PASS: all 24 non-RLS client privileges revoked, 24 DML grants preserved, repeat and drift detected.")
finally:
    source_query("drop database if exists "+fixture_db+" with (force)")
