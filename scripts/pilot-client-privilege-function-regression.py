#!/usr/bin/env python3
"""Adversarial function EXECUTE grant regression in local disposable PostgreSQL17."""
import os
import subprocess
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit
source=os.environ.get("LOCAL_RESTORE_URL","")
parsed=urlsplit(source)
if parsed.scheme not in ("postgres","postgresql") or parsed.hostname not in ("127.0.0.1","localhost","::1") or parsed.path!="/wetudy_pilot_dr_source":
    raise SystemExit("Refusing any nonlocal/non-disposable PostgreSQL")
dbname="wetudy_pilot_function_grants"
target=urlunsplit((parsed.scheme,parsed.netloc,"/"+dbname,"",""))
root=Path(__file__).resolve().parent
def execsql(uri,query=None,file=None,should_succeed=True):
    args=["psql","-X","-A","-t","-v","ON_ERROR_STOP=1","--dbname",uri]
    if query is not None: args+=["-c",query]
    if file is not None: args+=["-f",str(file)]
    x=subprocess.run(args,capture_output=True,text=True,timeout=45)
    if (x.returncode==0)!=should_succeed:
        raise AssertionError("Unexpected synthetic function-grant regression outcome")
    return x.stdout
if "0"!=execsql(source,query="select count(*) from pg_database where datname='"+dbname+"'").splitlines()[-1].strip():
    raise SystemExit("Refusing to reuse existing function-grant test DB")
execsql(source,query="create database "+dbname)
try:
    execsql(target,query="""DO $r$ BEGIN
       IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
       IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
       END $r$;
       CREATE FUNCTION public.qa_security_sensitive() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT 'qa-only'::text $$;
       REVOKE ALL ON FUNCTION public.qa_security_sensitive() FROM PUBLIC;
       GRANT EXECUTE ON FUNCTION public.qa_security_sensitive() TO anon;""")
    preflight=root/"pilot-client-privilege-function-entrypoints.sql"
    execsql(target,file=preflight,should_succeed=False)
    execsql(target,query="REVOKE EXECUTE ON FUNCTION public.qa_security_sensitive() FROM anon")
    execsql(target,file=preflight)
    execsql(target,query="GRANT EXECUTE ON FUNCTION public.qa_security_sensitive() TO authenticated")
    execsql(target,file=preflight,should_succeed=False)
    execsql(target,query="REVOKE EXECUTE ON FUNCTION public.qa_security_sensitive() FROM authenticated")
    execsql(target,file=preflight)
    execsql(target,query="""CREATE FUNCTION public.qa_truncation_hazard() RETURNS void LANGUAGE plpgsql
      AS $$ BEGIN EXECUTE 'TRUNCATE TABLE public.qa_fixture'; END $$;""")
    execsql(target,file=preflight,should_succeed=False)
    execsql(target,query="DROP FUNCTION public.qa_truncation_hazard()")
    execsql(target,file=preflight)
    print("PASS local function-grant gate rejects anon/authenticated SECURITY DEFINER EXECUTE and TRUNCATE token")
finally:
    execsql(source,query="drop database if exists "+dbname+" with (force)")
