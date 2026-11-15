#!/usr/bin/env python3
"""CI-only PostgreSQL 17 execution of allowlisted RLS policy with fake identities.

Uses disposable GitHub Actions postgres:17 service; NEVER decrypts backups, reads
production env, invokes Supabase, or writes real user data. Script explicitly
refuses execution absent a CI gate.
"""
import importlib.util
import os
from pathlib import Path
import shutil
import sys

def run():
    if (os.environ.get("WETUDY_SYNTHETIC_POSTGRES_CI") != "yes"
            or os.environ.get("PGPASSWORD") != "ci_synthetic_only_not_secret"
            or os.environ.get("PGHOST") != "127.0.0.1"):
        raise RuntimeError("Refusing non-synthetic CI PostgreSQL target")
    module = Path(__file__).with_name("pilot-founder-macos-archived-rls-replay.py")
    spec = importlib.util.spec_from_file_location("wetudy_mac_rls_ci", module)
    app = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(app)
    assert app.DB == "wetudy_dr_local_20261115"
    assert app.USER == "wetudy_dr_restore"
    fixture = ("CREATE POLICY saved_search_matches_select_own "
               "ON public.saved_search_matches FOR SELECT TO authenticated "
               "USING (( SELECT auth.uid() AS uid) = user_id);\n"
               "CREATE POLICY saved_search_matches_delete_own "
               "ON public.saved_search_matches FOR DELETE TO authenticated "
               "USING (( SELECT auth.uid() AS uid) = user_id);\n")
    vetted = app.extract_strict_policy_statements(fixture)
    psql = shutil.which("psql")
    if not psql:
        raise RuntimeError("psql not installed")
    out = app.run_psql(psql, os.environ["PGPASSWORD"],
                       app.synthetic_transaction(vetted))
    missing = app.EXPECTED_RESULTS - out
    if missing:
        # Only fixed expected labels, never interpolate SQL or credentials.
        raise RuntimeError("Synthetic RLS failed an assertion")
    # The SQL transaction ROLLBACK must leave the database blank.
    leftover = app.run_psql(psql, os.environ["PGPASSWORD"],
                            "SELECT 'leftover=' || ("
                            "to_regclass('public.saved_search_matches') IS NULL"
                            " AND to_regnamespace('auth') IS NULL);")
    if "leftover=true" not in leftover:
        raise RuntimeError("Synthetic RLS left persistent schema objects")
    print("PASS_CI_PG17_RLS_SYNTHETIC: 2 policies applied, "
          "both owners isolated, no JWT denied, own DELETE allowed, "
          "ROLLBACK verified; zero real backup rows")

if __name__ == "__main__":
    try:
        run()
    except (ValueError, RuntimeError, OSError):
        print("NO_GO_CI_PG17_RLS_SYNTHETIC", file=sys.stderr)
        sys.exit(2)
