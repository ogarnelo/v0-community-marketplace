#!/usr/bin/env python3
"""Fail-closed RLS policy drift regression in disposable PostgreSQL17 only."""
import os
import subprocess
from pathlib import Path
from urllib.parse import urlsplit
source = os.environ.get("LOCAL_RESTORE_URL", "")
p = urlsplit(source)
if (p.scheme not in ("postgres", "postgresql") or
        p.hostname not in ("localhost", "127.0.0.1", "::1") or
        p.path != "/wetudy_pilot_dr_source"):
    raise SystemExit("Refusing any nonlocal or unexpected PostgreSQL URL")

root = Path(__file__).resolve().parent
def call(args, expect_success=True):
    r = subprocess.run(["psql","-X","-v","ON_ERROR_STOP=1",
                        "--dbname",source,*args],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       text=True, timeout=45)
    if (r.returncode == 0) != expect_success:
        raise AssertionError("Unexpected RLS fixture/preflight result")
    return r

call(["-f",str(root/"pilot-marketplace-rls-drift-fixture.sql")])
preflight = str(root/"pilot-marketplace-rls-readonly-preflight.sql")
call(["-f",preflight])

# A new permissive SELECT policy ORs in access even though the owner policy
# still exists. The previous gate used to miss this exact failure mode.
call(["-c","create policy qa_rogue_select on public.saved_searches "
      "for select to authenticated using (true)"])
call(["-f",preflight],expect_success=False)
call(["-c","drop policy qa_rogue_select on public.saved_searches"])
call(["-f",preflight])

# A changed existing DELETE policy is also a security regression.
call(["-c","drop policy saved_search_matches_delete_own on public.saved_search_matches;"
      "create policy saved_search_matches_delete_own on public.saved_search_matches "
      "for delete to authenticated using (true)"])
call(["-f",preflight],expect_success=False)
call(["-c","drop policy saved_search_matches_delete_own on public.saved_search_matches;"
      "create policy saved_search_matches_delete_own on public.saved_search_matches "
      "for delete to authenticated using ((select auth.uid())=user_id)"])
call(["-f",preflight])

# An unexpected permissive policy on the system's postal-centroid reference
# is refused, even if no user-data rows exist.
call(["-c","create policy qa_rogue_postal_read on public.marketplace_postal_centroids "
      "for select to anon using (true)"])
call(["-f",preflight],expect_success=False)
call(["-c","drop policy qa_rogue_postal_read on public.marketplace_postal_centroids"])
call(["-f",preflight])
print("PASS: baseline allowed; permissive extra policies and weakened owner DELETE blocked.")
