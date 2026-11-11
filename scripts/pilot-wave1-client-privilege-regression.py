#!/usr/bin/env python3
"""Wave-1 permission migration regression: disposable PostgreSQL17 only."""
import os
import subprocess
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

source=os.environ.get("LOCAL_RESTORE_URL","")
p=urlsplit(source)
if p.scheme not in ("postgres","postgresql") or p.hostname not in (
    "localhost","127.0.0.1","::1") or p.path!="/wetudy_pilot_dr_source":
    raise SystemExit("Refusing non-disposable PostgreSQL")
dbname="wetudy_pilot_wave1_acl"
url=urlunsplit((p.scheme,p.netloc,"/"+dbname,"",""))
root=Path(__file__).resolve().parent
tables=("profiles","listings","listing_photos","schools","school_codes",
        "school_access_codes","user_roles","notifications")
roles=("anon","authenticated")
denied=("TRUNCATE","REFERENCES","TRIGGER","MAINTAIN")
ordinary=("SELECT","INSERT","UPDATE","DELETE")
migration=str(root.parent/"supabase/migrations/20261111084000_pilot_wave1_revoke_client_non_rls_privileges.sql")

def query(url,sql,expect_ok=True):
    cp=subprocess.run(["psql","-X","-A","-t","-v","ON_ERROR_STOP=1",
                       "--dbname",url,"-c",sql],capture_output=True,text=True,timeout=40)
    if (cp.returncode==0)!=expect_ok:
        raise AssertionError("Unexpected SQL result in disposable ACL test")
    return cp.stdout.strip()

def execute_file(path):
    cp=subprocess.run(["psql","-X","-v","ON_ERROR_STOP=1","--dbname",url,
                       "-f",path],capture_output=True,text=True,timeout=50)
    if cp.returncode: raise AssertionError("Disposable wave-1 migration failed")

def privilege(t,r,p):
    return query(url,"select has_table_privilege('"+r+"','public."+t+"','"+p+"')")

if query(source,"select count(*) from pg_database where datname='"+dbname+"'")!="0":
    raise SystemExit("Refusing to overwrite existing QA database")
query(source,"create database "+dbname)
try:
    query(url,"do $$ begin if not exists(select from pg_roles where rolname='anon') "
        "then create role anon nologin; end if; if not exists(select from pg_roles "
        "where rolname='authenticated') then create role authenticated nologin; "
        "end if; end $$")
    for t in tables:
        query(url,"create table public."+t+" (id bigint primary key)")
        query(url,"grant all privileges on table public."+t+" to anon,authenticated")
    before={(t,r,p):privilege(t,r,p) for t in tables for r in roles
            for p in denied+ordinary}
    if set(before.values())!={"t"}:
        raise AssertionError("Synthetic ACL fixture did not grant all permissions")
    execute_file(migration)
    after={(t,r,p):privilege(t,r,p) for t in tables for r in roles
           for p in denied+ordinary}
    for (t,r,p),value in after.items():
        if value != ("f" if p in denied else "t"):
            raise AssertionError("Unexpected post-migration ACL on synthetic table")
    execute_file(migration) # repeat should not fail
    query(url,"grant truncate on public.profiles to authenticated")
    if privilege("profiles","authenticated","TRUNCATE")!="t":
        raise AssertionError("Failed to simulate re-grant")
    execute_file(migration)
    if privilege("profiles","authenticated","TRUNCATE")!="f":
        raise AssertionError("Wave-1 remediation did not remove renewed grant")
    print("PASS: 64 excess privilege grants removed; 64 ordinary grants retained;"
          " idempotence and re-grant recovery verified in disposable PG17.")
finally:
    query(source,"drop database if exists "+dbname+" with (force)")
