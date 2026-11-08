#!/usr/bin/env python3
"""Reproducible local-only benchmark of the ACTUAL Wetudy AMPA member count RPC.

This script NEVER connects to production. It accepts only localhost PostgreSQL,
uses fictional deterministic UUIDs, compares against an independent EXISTS/OR
equivalent of the legacy JS rules, and measures realistic indexed query plans.
Timing is context-dependent; output is NOT a production SLA.
"""
import json
import os
import re
import statistics
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

dsn=os.environ.get("DATABASE_URL","")
parts=urlsplit(dsn)
if parts.scheme not in ("postgres","postgresql") or parts.hostname not in ("localhost","127.0.0.1","::1"):
    raise SystemExit("Refusing to benchmark any database other than localhost")
if not dsn:
    raise SystemExit("DATABASE_URL must point to disposable local PostgreSQL")

schools=[
 "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
 "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
 "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
]
def sql(query):
    cmd=["psql","-X","-A","-t","-v","ON_ERROR_STOP=1",dsn,"-c",query]
    run=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                       text=True,timeout=85,check=False)
    if run.returncode:
        raise RuntimeError(f"SQL failed: {run.stderr[-1200:]}")
    return run.stdout.strip()

src=Path("supabase/migrations/20261108211948_school_member_count_aggregate_20261108.sql").read_text()
m=re.search(r"\bas\s+\$\$\s*(select count\(\*\).*?)\s*\$\$;",src,flags=re.I|re.S)
if not m:
    raise SystemExit("Cannot extract query body of ACTUAL deployed AMPA SQL RPC")
query_body=m.group(1).strip().rstrip(";")
if "from public.profiles" not in query_body or "union" not in query_body:
    raise SystemExit("Unexpected stored AMPA function body")

checks=sql("select has_function_privilege('anon','public.server_school_member_count(uuid)','EXECUTE'),"
           "has_function_privilege('authenticated','public.server_school_member_count(uuid)','EXECUTE'),"
           "has_function_privilege('service_role','public.server_school_member_count(uuid)','EXECUTE');")
if checks!="f|f|t":
    raise AssertionError(f"Unexpected RPC grants: {checks!r}")
stats=sql("select (select count(*) from public.profiles),"
          "(select count(*) from public.account_students),"
          "(select count(*) from public.user_roles);")
if stats!="60000|120000|3000":
    raise AssertionError(f"Synthetic fixture unexpected rows: {stats!r}")

def independent_count(school):
    return int(sql(f"""select count(*) from public.profiles p
      where
        exists(select 1 from public.account_students a
               where a.owner_user_id=p.id and a.active=true and a.school_id='{school}'::uuid)
        or exists(select 1 from public.user_roles r
               where r.user_id=p.id and r.role='school_admin' and r.school_id='{school}'::uuid)
        or (p.school_id='{school}'::uuid
               and not exists(select 1 from public.account_students a
                              where a.owner_user_id=p.id and a.active=true))"""))

def function_count(school):
    return int(sql("select public.server_school_member_count('"+school+"'::uuid)"))

counts={}
for label, school in zip(("ALFA","BETA","GAMMA"),schools):
    expected=independent_count(school)
    actual=function_count(school)
    if actual!=expected:
        raise AssertionError(f"{label}: current RPC={actual} != independent definition={expected}")
    counts[label]=actual
if function_count("99999999-9999-4999-8999-999999999999")!=0:
    raise AssertionError("Unknown school must have zero members")

def plan(school, use_body=False):
    q=(re.sub(r"\bp_school_id\b",f"'{school}'::uuid",query_body)
       if use_body else f"select public.server_school_member_count('{school}'::uuid)")
    return json.loads(sql("explain (analyze,buffers,format json) "+q))[0]

def index_names(node):
    names=set()
    if node.get("Index Name"):
        names.add(node["Index Name"])
    for sub in node.get("Plans",[]):
        names.update(index_names(sub))
    return names

def median_ms(school):
    return round(statistics.median(plan(school)["Execution Time"] for _ in range(3)),3)

baseline={label:median_ms(school) for label,school in zip(("ALFA","BETA","GAMMA"),schools)}
body_before=plan(schools[0],use_body=True)
before_indexes=sorted(index_names(body_before["Plan"]))

# Candidate index is added ONLY in disposable PG. Existing production index
# account_students_school_grade_idx already has school_id leading.
sql("create index qa_school_owner_active_candidate on public.account_students(school_id,owner_user_id) where active=true; "
    "analyze public.account_students;")
candidate={label:median_ms(school) for label,school in zip(("ALFA","BETA","GAMMA"),schools)}
body_after=plan(schools[0],use_body=True)
after_indexes=sorted(index_names(body_after["Plan"]))
idx_bytes=int(sql("select pg_relation_size('public.qa_school_owner_active_candidate')"))
for label, school in zip(("ALFA","BETA","GAMMA"),schools):
    if function_count(school)!=counts[label]:
        raise AssertionError(f"Index changed result of {label} count")

print("PASS: actual checked-in production RPC in disposable PG17, role grants f|f|t, 3 synthetic schools.")
print("PASS: 60,000 profiles, 120,000 contexts, 3,000 AMPA roles, school counts agree with independent EXISTS/OR rules.")
print("NOTE: median timings are LOCAL runner measurements, not production latency or SLA.")
print("BENCHMARK_JSON "+json.dumps({
  "profiles":60000,"student_contexts":120000,"admin_roles":3000,
  "counts":counts,"existing_indexes_median_ms":baseline,
  "candidate_index_median_ms":candidate,
  "body_existing_execution_ms":round(body_before["Execution Time"],3),
  "body_candidate_execution_ms":round(body_after["Execution Time"],3),
  "existing_indexes_used":before_indexes,
  "candidate_indexes_used":after_indexes,
  "candidate_index_bytes":idx_bytes,
  "candidate_index_created_only_in_disposable_postgres":True
},ensure_ascii=False,sort_keys=True))
