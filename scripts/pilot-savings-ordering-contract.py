#!/usr/bin/env python3
"""QA-only global estimated-savings ordering/RLS drill on localhost PostgreSQL.

No external DB connection, no real user or listing data, no hosted migration.
Creates disposable roles + database in an ephemeral CI PostgreSQL service.
"""
import os
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

SOURCE = os.environ.get("LOCAL_DB_URL", "")
parsed = urlsplit(SOURCE)
if parsed.scheme not in ("postgres", "postgresql") or parsed.hostname not in (
    "localhost", "127.0.0.1", "::1"
) or parsed.path != "/postgres":
    raise SystemExit("Refusing to use a non-loopback or non-/postgres database")
NAME = "wetudy_qa_savings_view"
DEST = urlunsplit((parsed.scheme, parsed.netloc, "/" + NAME, "", ""))
ROOT = Path(__file__).resolve().parents[1]
VIEW = ROOT / "scripts/pilot-savings-view-candidate.sql"
FEED = ROOT / "app/api/marketplace/feed/route.ts"
SCHOOL = ROOT / "app/api/marketplace/my-school/route.ts"

def sql(url, statement=None, path=None, expect_ok=True):
    argv = ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
            "--dbname", url]
    argv += ["-f", str(path)] if path else ["-c", statement]
    p = subprocess.run(argv, text=True, capture_output=True, timeout=35)
    if expect_ok and p.returncode:
        raise RuntimeError("Local SQL check failed; no hosted database contacted")
    return p

def scalar(url, statement):
    return sql(url, statement).stdout.strip()

def main():
    source = VIEW.read_text()
    if "security_invoker = true" not in source:
        raise AssertionError("Savings view must enforce invoker RLS")
    if "GRANT SELECT" not in source or "REVOKE ALL" not in source:
        raise AssertionError("Savings view needs explicit limited grants")
    columns = list(dict.fromkeys(re.findall(r"\bl\.(\w+)\b", source)))
    for route in (FEED, SCHOOL):
        text = route.read_text()
        match = re.search(r'const FIELDS\s*=\s*"([^"]+)"', text)
        if not match:
            raise AssertionError("Listing API fields not found")
        fields = [x.strip() for x in match.group(1).split(",")]
        if not set(fields) <= set(columns):
            raise AssertionError("Candidate view omits current listing API fields")
    if "estimated_savings" in columns or "id" not in columns:
        raise AssertionError("Unexpected candidate fields")
    if scalar(SOURCE, "SELECT count(*) FROM pg_database WHERE datname='" + NAME + "'") != "0":
        raise AssertionError("Refusing to overwrite existing QA database")
    if scalar(SOURCE,
      "SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated')") != "0":
        raise AssertionError("Fresh isolated Postgres needed; refusing existing API roles")
    roles = False
    database = False
    try:
        sql(SOURCE, "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN")
        roles = True
        sql(SOURCE, "CREATE DATABASE " + NAME)
        database = True
        definitions = []
        for name in columns:
            data_type = (
                "uuid" if name in ("id", "seller_id", "user_id", "school_id")
                else "numeric" if name in ("price", "original_price",
                                             "estimated_retail_price")
                else "timestamptz" if name == "created_at"
                else "text"
            )
            definitions.append(name + " " + data_type)
        sql(DEST, "CREATE TABLE public.listings (" +
            ", ".join(definitions) + ", PRIMARY KEY(id))")
        sql(DEST, """ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
             CREATE POLICY qa_listing_visible ON public.listings
               FOR SELECT TO anon, authenticated USING(status='available');
             GRANT SELECT ON public.listings TO anon, authenticated;""")
        ids = [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            "33333333-3333-4333-8333-333333333333",
            "44444444-4444-4444-8444-444444444444",
            "55555555-5555-4555-8555-555555555555",
            "66666666-6666-4666-8666-666666666666",
        ]
        inserts = [
            (ids[0],"sale",12,100,None,"available"),
            (ids[1],"donation",None,None,45,"available"),
            (ids[2],"sale",2,3,None,"available"),
            (ids[3],"sale",1,1000,None,"archived"),
            (ids[4],"sale",20,10,None,"available"),
            (ids[5],"donation",None,None,None,"available"),
        ]
        for i,(item_id,typ,price,original,estimated,status) in enumerate(inserts):
            def num(value):
                return "NULL" if value is None else str(value)
            sql(DEST, "INSERT INTO public.listings(" +
                "id,type,price,original_price,estimated_retail_price,status,created_at" +
                ") VALUES ('" + item_id + "','" + typ + "'," + num(price) + "," +
                num(original) + "," + num(estimated) + ",'" + status + "'," +
                "'2026-11-09T10:00:00Z'::timestamptz + interval '" +
                str(i) + " minutes')")
        sql(DEST, path=VIEW)
        options = scalar(DEST, "SELECT array_to_string(reloptions,',') "
                        "FROM pg_class WHERE relname='marketplace_listings_sortable'")
        if "security_invoker=true" not in options:
            raise AssertionError("View would bypass RLS")
        ordered = scalar(DEST, """BEGIN;
          SET LOCAL ROLE anon;
          SELECT string_agg(id::text,',' ORDER BY estimated_savings DESC,
                            created_at DESC,id DESC)
          FROM public.marketplace_listings_sortable WHERE status='available';
          ROLLBACK;""")
        expected = [ids[0],ids[1],ids[2],ids[5],ids[4]]
        # Two zero-saving records are ordered by descending created_at.
        if ordered != ",".join(expected):
            raise AssertionError("Global savings sort differs from expected synthetic fixture")
        hidden = scalar(DEST, "BEGIN; SET LOCAL ROLE anon; SELECT count(*) "
           "FROM public.marketplace_listings_sortable WHERE id='" + ids[3] +
           "'; ROLLBACK;")
        if hidden != "0":
            raise AssertionError("Security invoker view bypassed base-table RLS")
        counts = scalar(DEST, "BEGIN; SET LOCAL ROLE authenticated; "
           "SELECT count(*) FROM public.marketplace_listings_sortable; ROLLBACK;")
        if counts != "5":
            raise AssertionError("Authenticated query mismatch; expected five visible rows")
        print("PASS local savings view: server-global order, donations, "
              "negative savings clamped, strict RLS, precise selected fields.")
        print("LIMIT: candidate is NOT a migration. "
              "No hosted Supabase changes and no production API switch.")
    finally:
        if database:
            sql(SOURCE, "DROP DATABASE IF EXISTS " + NAME + " WITH (FORCE)")
        if roles:
            sql(SOURCE, "DROP ROLE IF EXISTS authenticated; DROP ROLE IF EXISTS anon")

if __name__ == "__main__":
    main()
