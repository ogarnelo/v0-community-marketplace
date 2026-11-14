#!/usr/bin/env python3
"""PG17 disposable local test for atomic listings ACL proposal and transaction rollback."""
import os
import subprocess
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit
u=urlsplit(os.environ.get("LOCAL_RESTORE_URL",""))
if u.scheme not in ("postgres","postgresql") or u.hostname not in ("127.0.0.1","localhost","::1") or u.path!="/wetudy_pilot_dr_source":
    raise SystemExit("BLOCK: local PG17 disposable runner required")
def url(db): return urlunsplit((u.scheme,u.netloc,"/"+db,"",""))
def query(db,sql,ok=True):
    p=subprocess.run(["psql","-X","-A","-t","-q","-v","ON_ERROR_STOP=1","--dbname",url(db),"-c",sql],
      capture_output=True,text=True,timeout=45)
    if (p.returncode==0)!=ok:
        raise AssertionError("unexpected SQL result "+p.stderr[-200:])
    return p.stdout.strip()
def script(db,ok=True):
    p=subprocess.run(["psql","-X","-q","-v","ON_ERROR_STOP=1","--dbname",url(db),"-f",
       "scripts/pilot-listings-atomic-acl-review-only.sql"],capture_output=True,text=True,timeout=55)
    if (p.returncode==0)!=ok:
        raise AssertionError("atomic proposal unexpected result "+p.stderr[-250:])
    return p.stderr
cols=("id school_id user_id title description category grade_level condition "
"listing_type price estimated_retail_price status isbn author publisher format "
"language created_at updated_at seller_id type original_price photos subject "
"specific_type size_label brand model season book_edition_id directory_school_code "
"is_demo savings_amount postal_code lat lng").split()
assert len(cols)==36
dbs=["wetudy_qa_atomic_acl_pass","wetudy_qa_atomic_acl_rollback"]
root="wetudy_pilot_dr_source"
for db in dbs:
    if query(root,"SELECT count(*) FROM pg_database WHERE datname='"+db+"'")!="0":
        raise SystemExit("BLOCK: refusing to overwrite disposable database")
created=[]
try:
    query(root,"DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF; END $$")
    for db in dbs:
        query(root,"CREATE DATABASE "+db+" TEMPLATE template0")
        created.append(db)
        query(db,"CREATE TABLE public.listings ("+",".join(c+" text" for c in cols)+")")
        query(db,"GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role")
        query(db,"GRANT SELECT,INSERT,UPDATE,DELETE ON public.listings TO anon,authenticated")
        if db.endswith("_pass"):
            query(db,"GRANT SELECT ON public.listings TO service_role")
    success=dbs[0]
    script(success)
    checks=query(success,"SELECT NOT has_any_column_privilege('anon','public.listings','SELECT') AND NOT has_any_column_privilege('anon','public.listings','INSERT') AND NOT has_any_column_privilege('anon','public.listings','UPDATE') AND NOT has_table_privilege('anon','public.listings','DELETE') AND NOT has_table_privilege('authenticated','public.listings','SELECT') AND has_column_privilege('authenticated','public.listings','id','SELECT') AND NOT has_column_privilege('authenticated','public.listings','postal_code','SELECT') AND NOT has_column_privilege('authenticated','public.listings','lat','SELECT') AND NOT has_column_privilege('authenticated','public.listings','lng','SELECT') AND has_column_privilege('authenticated','public.listings','postal_code','UPDATE') AND has_table_privilege('service_role','public.listings','SELECT')")
    if checks!="t": raise AssertionError("postflight effective privileges incorrect")
    readable=query(success,"SELECT count(*) FROM pg_attribute a WHERE a.attrelid='public.listings'::regclass AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege('authenticated','public.listings',a.attname,'SELECT')")
    if readable!="33": raise AssertionError("authenticated expected precisely 33 readable columns")
    failure=dbs[1]
    error=script(failure,False)
    if "NO_GO_ATOMIC_ACL" not in error: raise AssertionError("missing fail-closed rollback signal")
    # Even though SQL ran with BEGIN, psql failure must abort and roll back all proposed ACLs.
    if query(failure,"SELECT has_table_privilege('anon','public.listings','SELECT') AND has_table_privilege('anon','public.listings','INSERT') AND has_table_privilege('authenticated','public.listings','SELECT')")!="t":
        raise AssertionError("rejected atomic proposal modified ACL")
    print("PASS PG17 atomic ACL: 33 auth columns, anon SELECT+DML denied, seller CP UPDATE preserved; negative preflight leaves grants intact")
finally:
    for db in reversed(created):
        query(root,"DROP DATABASE IF EXISTS "+db+" WITH (FORCE)")
