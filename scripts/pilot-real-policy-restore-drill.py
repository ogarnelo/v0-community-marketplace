#!/usr/bin/env python3
"""Selective restore of REAL policy DDL from a decrypted backup, with NO rows.

Creates and destroys one local disposable PostgreSQL17 database. Requires the
already-decrypted archive and its TOC, never connects to Supabase production.
"""
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit, urlunsplit

TARGET = "saved_search_matches"
POLICIES = {"saved_search_matches_select_own", "saved_search_matches_delete_own"}
DB = "wetudy_pilot_actual_rls_policy"
ID1 = "11111111-1111-4111-8111-111111111111"
ID2 = "22222222-2222-4222-8222-222222222222"


def psql(url, query, timeout=30):
    p = subprocess.run(["psql", "-X", "-q", "-A", "-t",
                       "-v", "ON_ERROR_STOP=1", "--dbname", url, "-c", query],
                       capture_output=True, text=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError("Disposable PostgreSQL query failed: " + p.stderr[-500:])
    return p.stdout.strip()


def check_local(url):
    u = urlsplit(url)
    if (u.scheme not in ("postgres", "postgresql")
            or u.hostname not in ("127.0.0.1", "localhost", "::1")
            or u.path != "/wetudy_restore"):
        raise SystemExit("Refusing nonlocal or unexpected PostgreSQL source")
    return urlunsplit((u.scheme, u.netloc, "/" + DB, "", ""))


def select_policies(toc):
    chosen = []
    for line in toc.splitlines():
        if re.search(r"\bPOLICY\s+public\s+" + TARGET + r"\s+", line):
            # Only saved_search_matches policies, not other tables or schemas.
            if any(re.search(r"\b" + re.escape(name) + r"\b", line)
                   for name in POLICIES):
                chosen.append(line)
    names = set()
    for line in chosen:
        for name in POLICIES:
            if re.search(r"\b" + re.escape(name) + r"\b", line):
                names.add(name)
    if len(chosen) != 2 or names != POLICIES:
        raise ValueError("Backup TOC missing exact two real own-user RLS policies")
    return "\n".join(chosen) + "\n"


def drill(archive, toc, url):
    dest = check_local(url)
    selection = select_policies(toc.read_text(encoding="utf8", errors="replace"))
    if psql(url, "select count(*) from pg_database where datname='" + DB + "'") != "0":
        raise SystemExit("Refusing to overwrite an existing local QA database")
    psql(url, "create database " + DB)
    try:
        psql(dest, """
        DO $$ BEGIN
          IF NOT EXISTS(select 1 from pg_roles where rolname='authenticated') THEN
            CREATE ROLE authenticated NOLOGIN;
          END IF;
        END $$;
        CREATE SCHEMA auth;
        GRANT USAGE ON SCHEMA auth TO authenticated;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
          $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
        GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
        CREATE TABLE public.saved_search_matches (
           id bigint PRIMARY KEY, user_id uuid NOT NULL);
        ALTER TABLE public.saved_search_matches ENABLE ROW LEVEL SECURITY;
        GRANT SELECT, DELETE ON public.saved_search_matches TO authenticated;
        INSERT INTO public.saved_search_matches (id,user_id) VALUES
          (1,'""" + ID1 + """'),(2,'""" + ID2 + """');
        """)
        with tempfile.TemporaryDirectory(prefix="wetudy-actual-policy-") as td:
            listing = Path(td) / "selected.toc"
            listing.write_text(selection, encoding="utf8")
            proc = subprocess.run(
                ["pg_restore", "--exit-on-error", "--schema-only", "--no-owner",
                 "--no-acl", "--use-list", str(listing), "--dbname", dest,
                 str(archive)],
                capture_output=True, text=True, timeout=50)
            if proc.returncode:
                raise RuntimeError("Real policy restore failed: " + proc.stderr[-600:])
        count = psql(dest, """select count(*) from pg_policies
          where schemaname='public' and tablename='saved_search_matches'
          and policyname in ('saved_search_matches_select_own',
                             'saved_search_matches_delete_own')
          and roles='{authenticated}';""")
        if count != "2":
            raise AssertionError("Real backup policies absent after restore")
        # Session-local JWT claims are synthetic. No user accounts exist.
        # Exercise both directions: cross-family SELECT/DELETE must fail even
        # after the first family legitimately removes its own record.
        checks = psql(dest, """
        BEGIN;
          SELECT set_config('request.jwt.claim.sub','""" + ID1 + """',true);
          SET LOCAL ROLE authenticated;
          SELECT 'owner1_visible='||count(*) FROM public.saved_search_matches;
          WITH deleted AS (
             DELETE FROM public.saved_search_matches WHERE id=2 RETURNING id)
          SELECT 'owner1_cross_delete='||count(*) FROM deleted;
          WITH deleted AS (
             DELETE FROM public.saved_search_matches WHERE id=1 RETURNING id)
          SELECT 'owner1_own_delete='||count(*) FROM deleted;
        COMMIT;

        BEGIN;
          SELECT set_config('request.jwt.claim.sub','""" + ID2 + """',true);
          SET LOCAL ROLE authenticated;
          SELECT 'owner2_visible='||count(*) FROM public.saved_search_matches;
          WITH deleted AS (
             DELETE FROM public.saved_search_matches WHERE id=1 RETURNING id)
          SELECT 'owner2_cross_delete='||count(*) FROM deleted;
        COMMIT;

        -- An authenticated role without a JWT subject must not see or delete
        -- any remaining owner-owned row.
        BEGIN;
          SELECT set_config('request.jwt.claim.sub','',true);
          SET LOCAL ROLE authenticated;
          SELECT 'missing_jwt_visible='||count(*) FROM public.saved_search_matches;
          WITH deleted AS (
             DELETE FROM public.saved_search_matches WHERE id=2 RETURNING id)
          SELECT 'missing_jwt_delete='||count(*) FROM deleted;
        COMMIT;
        SELECT 'remaining='||count(*) FROM public.saved_search_matches;
        """).splitlines()
        expected = {
            "owner1_visible=1", "owner1_cross_delete=0", "owner1_own_delete=1",
            "owner2_visible=1", "owner2_cross_delete=0",
            "missing_jwt_visible=0", "missing_jwt_delete=0", "remaining=1"}
        if not expected.issubset(set(checks)):
            raise AssertionError(
                "Restored RLS policies failed mutual owner / missing-JWT checks")
        print("PASS: two REAL archived policies installed on disposable PG17; "
              "mutual owner isolation and missing-JWT denial verified with "
              "synthetic rows; no real backup rows, Auth or Storage restored.")
    finally:
        psql(url, "drop database if exists " + DB + " with (force)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: pilot-real-policy-restore-drill.py ARCHIVE TOC")
    drill(Path(sys.argv[1]), Path(sys.argv[2]),
          os.environ.get("LOCAL_RESTORE_URL", ""))
