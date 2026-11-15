#!/usr/bin/env python3
"""Synthetic PostgreSQL 17 default ACL fixture. Refuses nonlocal databases."""
import os
import subprocess
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit
root=Path(__file__).resolve().parents[1]
migration=root/"scripts/p0_public_default_acl_review_only.sql"
u=urlsplit(os.environ.get("LOCAL_RESTORE_URL",""))
if u.scheme not in ("postgres","postgresql") or u.hostname not in ("127.0.0.1","localhost","::1") or u.path!="/wetudy_pilot_dr_source":
    raise SystemExit("Refusing nonlocal database for ACL regression")
dbname="wetudy_default_acl_fixture"
base=os.environ["LOCAL_RESTORE_URL"]
db=urlunsplit((u.scheme,u.netloc,"/"+dbname,"",""))
def run(uri,sql=None,file=None,success=True):
    args=["psql","-X","-v","ON_ERROR_STOP=1","-A","-t","--dbname",uri]
    args+=["-f",str(file)] if file else ["-c",sql]
    r=subprocess.run(args,text=True,capture_output=True,timeout=45)
    if (r.returncode==0)!=success:
        raise AssertionError("Unexpected fixture SQL outcome: "+r.stderr[-1000:])
    return r.stdout.strip() if success else r.stderr.strip()

if run(base,"SELECT count(*) FROM pg_database WHERE datname='"+dbname+"'")!="0":
    raise SystemExit("Do not overwrite a prior fixture database")
run(base,"CREATE DATABASE "+dbname)
try:
    run(db,"""DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='supabase_admin') THEN CREATE ROLE supabase_admin NOLOGIN; END IF;
    END $$""")
    run(db,"GRANT CREATE,USAGE ON SCHEMA public TO supabase_admin")
    for owner in ("postgres","supabase_admin"):
        run(db,"ALTER DEFAULT PRIVILEGES FOR ROLE "+owner+" IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated")
    run(db,"CREATE TABLE public.before_default_acl (id bigint)")
    run(db,"GRANT ALL ON public.before_default_acl TO anon,authenticated")
    run(db,file=migration)
    run(db,file=migration) # rerun idempotently; postflight still zero
    for role in ("anon","authenticated"):
        for p in ("SELECT","INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"):
            if run(db,"SELECT has_table_privilege('"+role+"','public.before_default_acl','"+p+"')")!="t":
                raise AssertionError("Existing table grants unexpectedly touched")
    run(db,"BEGIN; SET LOCAL ROLE postgres; CREATE TABLE public.after_postgres (id bigint); COMMIT;")
    run(db,"BEGIN; SET LOCAL ROLE supabase_admin; CREATE TABLE public.after_supabase_admin (id bigint); COMMIT;")
    for t in ("after_postgres","after_supabase_admin"):
        for role in ("anon","authenticated"):
            for p in ("SELECT","INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"):
                if run(db,"SELECT has_table_privilege('"+role+"','public."+t+"','"+p+"')")!="f":
                    raise AssertionError("New table inherited unexpected client privilege")
    # Deliberate preflight drift: one new default SELECT grant is neither 0 nor 32.
    run(db,"ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO anon")
    err=run(db,file=migration,success=False)
    if "NO_GO_DEFAULT_ACL: expected 0 or 32" not in err:
        raise AssertionError("Default privilege drift must fail closed")
    print("PASS PG17: existing table grants unaffected; two owners' future tables deny client access; rerun and drift checks")
finally:
    run(base,"DROP DATABASE IF EXISTS "+dbname+" WITH (FORCE)")
