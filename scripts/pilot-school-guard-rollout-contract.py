#!/usr/bin/env python3
"""Test EXACT school-guard SQL including failed preflight and emergency rollback.

ONLY works with an explicit loopback PostgreSQL /postgres URL and a newly
created isolated scratch database. Never use remotely hosted databases.
"""
import os
import subprocess
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit

SRC=os.environ.get("LOCAL_DB_URL","")
u=urlsplit(SRC)
if u.scheme not in ("postgres","postgresql") or u.hostname not in (
    "localhost","127.0.0.1","::1") or u.path!="/postgres":
    raise SystemExit("Refusing to run release contract outside localhost")
NAME="wetudy_qa_guard_rollout_probe"
TARGET=urlunsplit((u.scheme,u.netloc,"/"+NAME,"",""))
ROOT=Path(__file__).resolve().parents[1]
CANDIDATE=ROOT/"scripts"/"pilot-active-school-release-candidate.sql"
ROLLBACK=ROOT/"scripts"/"pilot-active-school-emergency-rollback.sql"
ACTIVE="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
INACTIVE="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
USER="cccccccc-cccc-4ccc-8ccc-cccccccccccc"

def psql(conn,query=None,file=None,expect_success=True):
    args=["psql","-X","-A","-t","-v","ON_ERROR_STOP=1","--dbname",conn]
    args.extend(["-f",str(file)] if file else ["-c",query])
    r=subprocess.run(args,capture_output=True,text=True,timeout=45)
    if expect_success and r.returncode!=0:
        # Avoid echoing SQL or credentials from a failing subprocess.
        raise RuntimeError("Local PostgreSQL command failed during "+(
           str(file.name) if file else "probe"))
    return r
def scalar(query,conn=TARGET):
    return psql(conn,query).stdout.strip()
def main():
    if scalar("SELECT count(*) FROM pg_database WHERE datname='"+NAME+"'",SRC)!="0":
        raise AssertionError("Scratch database already exists; refusing overwrite")
    psql(SRC,"CREATE DATABASE "+NAME)
    try:
        psql(TARGET,"CREATE TABLE public.schools(id uuid PRIMARY KEY,is_active boolean);"
             "CREATE TABLE public.profiles(id uuid PRIMARY KEY,school_id uuid);")
        psql(TARGET,"INSERT INTO public.schools VALUES ('"+ACTIVE+"',true),('"+
             INACTIVE+"',false);"
             "INSERT INTO public.profiles VALUES('"+USER+"','"+INACTIVE+"')")
        # Fail-closed deploy: pre-existing invalid links mean ZERO changes
        # persist (including the newly created function and trigger).
        fail=psql(TARGET,file=CANDIDATE,expect_success=False)
        if fail.returncode==0 or "school_guard_preflight_invalid_profiles" not in fail.stderr:
            raise AssertionError("Invalid legacy profile was not rejected on deployment")
        if scalar("SELECT count(*) FROM pg_trigger WHERE tgname='active_profile_school_guard'")!="0":
            raise AssertionError("Failed transaction unexpectedly installed trigger")
        if scalar("SELECT count(*) FROM pg_proc WHERE proname='enforce_active_profile_school'")!="0":
            raise AssertionError("Failed transaction unexpectedly installed function")
        # Correct only scratch data, then apply the EXACT production candidate.
        psql(TARGET,"UPDATE public.profiles SET school_id='"+ACTIVE+"'")
        psql(TARGET,file=CANDIDATE)
        if scalar("SELECT count(*) FROM pg_trigger WHERE tgname='active_profile_school_guard'")!="1":
            raise AssertionError("Guard trigger not installed")
        for invalid in (INACTIVE,"dddddddd-dddd-4ddd-8ddd-dddddddddddd"):
            result=psql(TARGET,"UPDATE public.profiles SET school_id='"+invalid+"'",
                        expect_success=False)
            if result.returncode==0 or "school_unavailable" not in result.stderr:
                raise AssertionError("Candidate failed to reject invalid school")
            if scalar("SELECT school_id FROM public.profiles")!=ACTIVE:
                raise AssertionError("Rejected update unexpectedly modified profile")
        psql(TARGET,"UPDATE public.profiles SET school_id=NULL")
        if scalar("SELECT school_id IS NULL FROM public.profiles")!="t":
            raise AssertionError("Candidate blocked voluntary unlink")
        psql(TARGET,"UPDATE public.profiles SET school_id='"+ACTIVE+"'")
        # Re-apply proves candidate is idempotent.
        psql(TARGET,file=CANDIDATE)
        psql(TARGET,file=ROLLBACK)
        if scalar("SELECT count(*) FROM pg_trigger WHERE tgname='active_profile_school_guard'")!="0":
            raise AssertionError("Rollback did not remove trigger")
        if scalar("SELECT count(*) FROM pg_proc WHERE proname='enforce_active_profile_school'")!="0":
            raise AssertionError("Rollback did not remove function")
        # Rollback intentionally reopens bypass; demonstrate on scratch only.
        psql(TARGET,"UPDATE public.profiles SET school_id='"+INACTIVE+"'")
        print("PASS release guard: fails closed on invalid legacy links, installs and "
              "rejects missing/inactive schools, permits unlink, is idempotent, "
              "and emergency rollback removes the guard on local scratch DB.")
        print("LIMIT: NO migration was installed on hosted Supabase.")
    finally:
        psql(SRC,"DROP DATABASE IF EXISTS "+NAME+" WITH (FORCE)")

if __name__=="__main__":
    main()
