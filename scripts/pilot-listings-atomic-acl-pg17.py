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
dbs=["wetudy_qa_atomic_acl_pass","wetudy_qa_atomic_acl_rollback",
     "wetudy_qa_atomic_acl_drift","wetudy_qa_atomic_acl_column_acl",
     "wetudy_qa_atomic_acl_rls_off"]
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
        if not db.endswith("_rls_off"):
            query(db,"ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY")
        query(db,"GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role")
        query(db,"GRANT SELECT,INSERT,UPDATE,DELETE ON public.listings TO anon,authenticated")
        if not db.endswith("_rollback"):
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
    # Defend against a schema updated since the founder reviewed the 36-column grant.
    drift=dbs[2]
    query(drift,"ALTER TABLE public.listings ADD COLUMN unexpectedly_added_private text")
    error=script(drift,False)
    if "NO_GO_ATOMIC_ACL" not in error or "unexpected listings schema" not in error:
        raise AssertionError("drifted schema did not trigger explicit preflight")
    if query(drift,"SELECT has_table_privilege('anon','public.listings','SELECT')")!="t":
        raise AssertionError("drift preflight changed grants")

    # REVOKE TABLE SELECT does not remove direct per-column SELECT grants.
    column_acl=dbs[3]
    query(column_acl,"GRANT SELECT (postal_code) ON public.listings TO anon")
    error=script(column_acl,False)
    if "unexpected direct anon/public column grant" not in error:
        raise AssertionError("unexpected column-level anon grant was not blocked")
    if query(column_acl,"SELECT has_column_privilege('anon','public.listings','postal_code','SELECT')")!="t":
        raise AssertionError("column ACL preflight unexpectedly modified grants")

    # No RLS makes existing public SELECT directly open every available row.
    rls_off=dbs[4]
    error=script(rls_off,False)
    if "row level security must already be enabled" not in error:
        raise AssertionError("RLS-off baseline was not blocked")
    if query(rls_off,"SELECT NOT relrowsecurity FROM pg_class WHERE oid='public.listings'::regclass")!="t":
        raise AssertionError("RLS-off preflight modified table RLS state")
    print("PASS PG17 atomic ACL: success plus 4 fail-closed rollback/preflight cases")
finally:
    for db in reversed(created):
        query(root,"DROP DATABASE IF EXISTS "+db+" WITH (FORCE)")
