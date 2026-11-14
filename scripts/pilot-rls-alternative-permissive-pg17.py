#!/usr/bin/env python3
"""Offline PG17 experiment: permissive RLS policies are ORed, so extra policies must fail a release gate.
Disposable localhost DB only. No production endpoint or personal data."""
import os
import subprocess
from urllib.parse import urlsplit,urlunsplit
u=urlsplit(os.environ.get("LOCAL_RESTORE_URL",""))
if u.scheme not in ("postgresql","postgres") or u.hostname not in ("127.0.0.1","localhost","::1") or u.path!="/wetudy_pilot_dr_source":
    raise SystemExit("BLOCK: require localhost disposable PostgreSQL17")
def url(db): return urlunsplit((u.scheme,u.netloc,"/"+db,"",""))
def psql(db,sql,success=True):
    p=subprocess.run(["psql","-X","-q","-A","-t","-v","ON_ERROR_STOP=1","--dbname",url(db),"-c",sql],
        capture_output=True,text=True,timeout=45)
    if (p.returncode==0)!=success: raise AssertionError("unexpected PostgreSQL outcome: "+p.stderr[-250:])
    return p.stdout.strip()
db="wetudy_qa_rls_alternative_policy"
if psql("wetudy_pilot_dr_source","SELECT count(*) FROM pg_database WHERE datname='"+db+"'")!="0":
    raise SystemExit("BLOCK: synthetic database already exists")
psql("wetudy_pilot_dr_source","CREATE DATABASE "+db+" TEMPLATE template0")
try:
    psql(db,"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$")
    psql(db,"CREATE TABLE public.qa_conversations(id int PRIMARY KEY,member text); CREATE TABLE public.qa_user_roles(id int PRIMARY KEY,user_role text)")
    psql(db,"INSERT INTO public.qa_conversations VALUES(1,'alice'),(2,'bob')")
    psql(db,"ALTER TABLE public.qa_conversations ENABLE ROW LEVEL SECURITY; ALTER TABLE public.qa_user_roles ENABLE ROW LEVEL SECURITY")
    psql(db,"GRANT USAGE ON SCHEMA public TO authenticated; GRANT SELECT ON public.qa_conversations TO authenticated; GRANT INSERT ON public.qa_user_roles TO authenticated")
    psql(db,"CREATE POLICY safe_chat ON public.qa_conversations FOR SELECT TO authenticated USING(member=current_setting('wetudy.viewer',true))")
    psql(db,"CREATE POLICY safe_admin ON public.qa_user_roles FOR INSERT TO authenticated WITH CHECK(current_setting('wetudy.is_admin',true)='yes')")
    select_user="BEGIN; SET LOCAL wetudy.viewer='alice'; SET LOCAL ROLE authenticated; SELECT count(*) FROM public.qa_conversations; ROLLBACK"
    def get_count(): return psql(db,select_user).splitlines()[0]
    if get_count()!="1": raise AssertionError("baseline chat RLS isolation failed")
    denied="BEGIN; SET LOCAL wetudy.is_admin='no'; SET LOCAL ROLE authenticated; INSERT INTO public.qa_user_roles VALUES(7,'super_admin'); ROLLBACK"
    psql(db,denied,False)
    psql(db,"CREATE POLICY bypass_chat ON public.qa_conversations FOR SELECT TO authenticated USING(true)")
    psql(db,"CREATE POLICY bypass_admin ON public.qa_user_roles FOR INSERT TO authenticated WITH CHECK(true)")
    if get_count()!="2": raise AssertionError("did not reproduce OR bypass on chat")
    psql(db,denied,True)
    # Catalog strict gate: safe policy remains but an added permissive policy must cause NO_GO.
    for table,cmd in [("qa_conversations","SELECT"),("qa_user_roles","INSERT")]:
        count=psql(db,"SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='"+table+"' AND cmd IN ('"+cmd+"','ALL')")
        if count!="2": raise AssertionError("alternative-policy fixture did not create two applicable policies")
    print("PASS PG17: safe policy exists but added permissive policy exposes unrelated chat and permits admin insert; exclusive-count gate required")
finally:
    psql("wetudy_pilot_dr_source","DROP DATABASE IF EXISTS "+db+" WITH (FORCE)")
