#!/usr/bin/env python3
"""PG17 localhost-only regression: table REVOKE must reject surviving column DML grants."""
import os
import subprocess
from urllib.parse import urlsplit, urlunsplit

url=os.environ.get("LOCAL_RESTORE_URL","")
u=urlsplit(url)
if u.scheme not in ("postgresql","postgres") or u.hostname not in ("localhost","127.0.0.1","::1") or u.path!="/wetudy_pilot_dr_source":
    raise SystemExit("BLOCK: local disposable PG17 only")
def dburl(database):
    return urlunsplit((u.scheme,u.netloc,"/"+database,"",""))
def run(database,sql,expect=True):
    p=subprocess.run(["psql","-X","-A","-t","-q","-v","ON_ERROR_STOP=1","--dbname",dburl(database),"-c",sql],
                     capture_output=True,text=True,timeout=50)
    if (p.returncode==0)!=expect: raise AssertionError("PG17 expected exit status mismatch")
    return p.stdout.strip()
name="wetudy_qa_anon_column_grants"
if run("wetudy_pilot_dr_source","SELECT count(*) FROM pg_database WHERE datname='"+name+"'").splitlines()[-1].strip()!="0":
    raise SystemExit("BLOCK: refusing to replace existing local DB")
run("wetudy_pilot_dr_source","CREATE DATABASE "+name+" TEMPLATE template0")
try:
    run(name,"DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$")
    run(name,"CREATE TABLE public.listings(id uuid,postal_code text)")
    run(name,"GRANT USAGE ON SCHEMA public TO anon,authenticated")
    run(name,"GRANT INSERT,UPDATE,DELETE ON public.listings TO anon,authenticated")
    run(name,"REVOKE INSERT,UPDATE,DELETE ON public.listings FROM anon")
    run(name,"GRANT INSERT(id), UPDATE(postal_code) ON public.listings TO anon")
    # Metadata should demonstrate the exact gap: no tablewide grant, positive column grant.
    result=run(name,"SELECT (NOT has_table_privilege('anon','public.listings','INSERT')) AND (NOT has_table_privilege('anon','public.listings','UPDATE')) AND has_any_column_privilege('anon','public.listings','INSERT') AND has_any_column_privilege('anon','public.listings','UPDATE')")
    if "t" not in result.splitlines(): raise AssertionError("fixture did not isolate column grants")
    sql=open("scripts/pilot-anon-listings-dml-hardening-proposal.sql",encoding="utf8").read()
    p=subprocess.run(["psql","-X","-v","ON_ERROR_STOP=1","--dbname",dburl(name)],
                     input=sql,text=True,capture_output=True,timeout=50)
    if p.returncode==0 or "NO_GO: anon still has listings table/column DML privileges" not in p.stderr:
        raise AssertionError("proposal failed to block surviving column DML grants")
    run(name,"REVOKE INSERT(id), UPDATE(postal_code) ON public.listings FROM anon")
    # With no surviving column privileges, the same review proposal must pass.
    p=subprocess.run(["psql","-X","-v","ON_ERROR_STOP=1","--dbname",dburl(name)],
                     input=sql,text=True,capture_output=True,timeout=50)
    if p.returncode!=0: raise AssertionError("proposal rejects clean permission state")
    print("PASS PG17: column-only anon INSERT/UPDATE causes NO_GO; cleaned state passes")
finally:
    run("wetudy_pilot_dr_source","DROP DATABASE IF EXISTS "+name+" WITH (FORCE)")
