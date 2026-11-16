#!/usr/bin/env python3
"""Local-only PG17 regression for the review-only listing photo uniqueness gate."""
import os, subprocess
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

root=Path(__file__).resolve().parents[1]
script=root/"scripts/p0_listing_photos_unique_review_only.sql"
url=os.environ.get("LOCAL_RESTORE_URL","")
parts=urlsplit(url)
if parts.scheme not in ("postgres","postgresql") or parts.hostname not in ("127.0.0.1","localhost","::1") or parts.path!="/wetudy_pilot_dr_source":
    raise SystemExit("REFUSE: requires exact isolated local PG17 connection")
dbname="wetudy_photo_unique_fixture"
local=urlunsplit((parts.scheme,parts.netloc,"/"+dbname,"",""))
def run(conn,sql=None,path=None,ok=True):
    args=["psql","-X","-v","ON_ERROR_STOP=1","-A","-t","--dbname",conn]
    args+=["-f",str(path)] if path else ["-c",sql]
    r=subprocess.run(args,capture_output=True,text=True,timeout=40)
    if (r.returncode==0)!=ok:
        raise AssertionError("Unexpected PG17 outcome: "+r.stderr[-900:])
    return r.stdout.strip() if ok else r.stderr
if run(url,"SELECT count(*) FROM pg_database WHERE datname='"+dbname+"'")!="0":
    raise SystemExit("REFUSE: existing fixture database")
run(url,"CREATE DATABASE "+dbname)
try:
    run(local,"CREATE TABLE public.listing_photos(id text PRIMARY KEY, listing_id uuid, url text NOT NULL, sort_order integer)")
    run(local,"ALTER TABLE public.listing_photos ENABLE ROW LEVEL SECURITY")
    run(local,"INSERT INTO public.listing_photos VALUES "+
        "('a','11111111-1111-4111-8111-111111111111','https://example.invalid/a.jpg',0),"+
        "('b','11111111-1111-4111-8111-111111111111','https://example.invalid/a.jpg',1)")
    before=run(local,"SELECT count(*) FROM public.listing_photos")
    error=run(local,path=script,ok=False)
    assert "P0_PHOTO_UNIQUE_NO_GO: duplicate" in error
    assert run(local,"SELECT count(*) FROM public.listing_photos")==before
    assert run(local,"SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='listing_photos_listing_url_unique'")=="0"
    run(local,"DELETE FROM public.listing_photos WHERE id='b'")
    run(local,"CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN")
    run(local,"GRANT SELECT,INSERT,UPDATE,DELETE ON public.listing_photos TO authenticated")
    grants_before=run(local,"SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='listing_photos' AND grantee='authenticated'")
    run(local,path=script)
    assert run(local,"SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid='public.listing_photos'::regclass AND c.relname='listing_photos_listing_url_unique' AND i.indisunique AND i.indisvalid")=="1"
    assert run(local,"SELECT relrowsecurity FROM pg_class WHERE oid='public.listing_photos'::regclass")=="t"
    assert run(local,"SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='listing_photos' AND grantee='authenticated'")==grants_before
    error=run(local,"INSERT INTO public.listing_photos VALUES('dup','11111111-1111-4111-8111-111111111111','https://example.invalid/a.jpg',1)",ok=False)
    assert "duplicate key" in error.lower()
    run(local,"INSERT INTO public.listing_photos VALUES('other','22222222-2222-4222-8222-222222222222','https://example.invalid/a.jpg',0)")
    run(local,"INSERT INTO public.listing_photos VALUES('orphan',NULL,'https://example.invalid/a.jpg',0)")
    error=run(local,path=script,ok=False)
    assert "index name already in use" in error
    assert run(local,"SELECT count(*) FROM public.listing_photos")=="3"
    print("PASS PG17: duplicates abort and roll back; unique repair key; other listings allowed; RLS/grants unchanged")
finally:
    run(url,"DROP DATABASE IF EXISTS "+dbname+" WITH (FORCE)")
