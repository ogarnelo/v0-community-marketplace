#!/usr/bin/env python3
"""Smoke-test real PostgREST authorization, isolated to a disposable PG17 DB.

Only synthetic rows, fake local-only keys, and a localhost HTTP endpoint.
This is NOT a production or real-Supabase integration test.
"""
import base64
import hashlib
import hmac
import json
import os
import subprocess
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

SOURCE_DB = "wetudy_pilot_dr_source"
TEST_DB = "wetudy_pilot_anon_select_wave1"
HOST = "127.0.0.1"
PORT = 3107
CONTAINER = "wetudy-anon-select-local-postgrest"
IMAGE = "postgrest/postgrest:v14.18"
FAKE_PASSWORD = "wetudy_disposable_local_2026"
FAKE_JWT_SECRET = "wetudy_only_synthetic_local_secret_20261120_123456789"
OWNER = "11111111-1111-4111-8111-111111111111"
OTHER = "22222222-2222-4222-8222-222222222222"
TABLES = ("agreements", "demand_requests", "profiles", "saved_searches", "schools")
PROPOSAL = Path(__file__).resolve().parent / "pilot-anon-select-wave1-local-only.sql"
ROLLBACK = Path(__file__).resolve().parent / "pilot-anon-select-rollback-local-only.sql"

source = os.environ.get("LOCAL_RESTORE_URL", "")
parts = urlsplit(source)
if (parts.scheme not in ("postgres", "postgresql")
    or parts.hostname not in ("localhost", "127.0.0.1", "::1")
    or parts.path != "/" + SOURCE_DB or not parts.username):
    raise SystemExit("Refusing nonlocal/non-disposable PostgreSQL")
if parts.password != "local_only_password":
    raise SystemExit("Only the synthetic CI PostgreSQL service credential is permitted")
test_url = urlunsplit((parts.scheme, parts.netloc, "/" + TEST_DB, "", ""))


def run(command, *, ok=True, timeout=50):
    result = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
    if (result.returncode == 0) != ok:
        raise AssertionError("Unexpected isolated command result: "
                             + " ".join(command[:2]) + " " + result.stderr[-450:])
    return result.stdout.strip(), result.stderr


def psql(url, statement=None, file=None):
    if (statement is None) == (file is None):
        raise AssertionError("Exactly one SQL source required")
    command = ["psql", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1",
               "--dbname", url]
    command += ["-c", statement] if statement is not None else ["-f", str(file)]
    return run(command)[0]


def base64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def signed_user_jwt(user_id):
    header = base64url(b'{"alg":"HS256","typ":"JWT"}')
    payload = base64url(json.dumps({
        "role": "authenticated", "sub": user_id,
        "iat": int(time.time()) - 5, "exp": int(time.time()) + 600
    }, separators=(",", ":")).encode())
    signed = header + "." + payload
    signature = base64url(hmac.new(
        FAKE_JWT_SECRET.encode(), signed.encode(), hashlib.sha256).digest())
    return signed + "." + signature


def get(table, jwt=None):
    headers = {"Accept": "application/json"}
    if jwt:
        headers["Authorization"] = "Bearer " + jwt
    req = Request("http://" + HOST + ":" + str(PORT) + "/" + table +
                  "?select=id,owner_id&order=id.asc", headers=headers)
    try:
        with urlopen(req, timeout=3) as response:
            return response.status, json.loads(response.read().decode())
    except HTTPError as error:
        return error.code, json.loads(error.read().decode())


def acl_fingerprint():
    """Capture effective eight-operation privilege matrix + RLS by table.

    This catches an unrelated client privilege becoming reachable during a
    rollback. It is not a complete pg_catalog ACL snapshot for production.
    """
    query = """
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'relation', c.relname, 'role', r.role_name,
        'select', has_table_privilege(r.role_name,c.oid,'SELECT'),
        'insert', has_table_privilege(r.role_name,c.oid,'INSERT'),
        'update', has_table_privilege(r.role_name,c.oid,'UPDATE'),
        'delete', has_table_privilege(r.role_name,c.oid,'DELETE'),
        'truncate', has_table_privilege(r.role_name,c.oid,'TRUNCATE'),
        'references', has_table_privilege(r.role_name,c.oid,'REFERENCES'),
        'trigger', has_table_privilege(r.role_name,c.oid,'TRIGGER'),
        'maintain', has_table_privilege(r.role_name,c.oid,'MAINTAIN'),
        'rls', c.relrowsecurity
      ) ORDER BY c.relname,r.role_name),'[]'::jsonb)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role'))
        AS r(role_name)
      WHERE n.nspname='public'
        AND c.relname IN ('agreements','demand_requests','profiles',
                          'saved_searches','schools')
    """
    matrix = json.loads(psql(test_url, query))
    if len(matrix) != 15 or not all(x["rls"] for x in matrix):
        raise AssertionError("Missing RLS matrix or target table in fixture")
    return matrix


def check_rows(expected_revoke):
    owner_token = signed_user_jwt(OWNER)
    other_token = signed_user_jwt(OTHER)
    for table in TABLES:
        status, guest = get(table)
        if expected_revoke:
            if status not in (401, 403) or not isinstance(guest, dict) \
                or guest.get("code") != "42501":
                raise AssertionError("Guest SELECT must be denied by PostgREST for " + table
                                     + " (status=" + str(status) + ")")
        elif status != 200 or guest != []:
            raise AssertionError("Before revoke, RLS should return empty guest rows: " + table)
        for token, uid in ((owner_token, OWNER), (other_token, OTHER)):
            status, result = get(table, token)
            if status != 200 or len(result) != 1 or result[0]["owner_id"] != uid:
                raise AssertionError("JWT / owner RLS incompatible for " + table
                                     + " (status=" + str(status) + ")")
    # This view remains SELECT-granted to anon but uses its invoker's
    # underlying table rights; it must become inaccessible after the revoke.
    view = "demand_opportunities_30d"
    status, guest = get(view)
    if expected_revoke:
        if status not in (401, 403) or not isinstance(guest, dict) \
            or guest.get("code") != "42501":
            raise AssertionError("Guest invoker-view dependency not denied")
    elif status != 200 or guest != []:
        raise AssertionError("Guest invoker-view RLS baseline incorrect")
    for user_id in (OWNER, OTHER):
        status, rows = get(view, signed_user_jwt(user_id))
        if status != 200 or len(rows) != 1 or rows[0]["owner_id"] != user_id:
            raise AssertionError("Authorized invoker-view regression")


if psql(source, "select count(*) from pg_database where datname='"
        + TEST_DB + "'") != "0":
    raise SystemExit("Refusing to overwrite existing QA database")

psql(source, "create database " + TEST_DB)
container_started = False
try:
    psql(test_url, """do $$
    begin
      if to_regrole('anon') is null then create role anon nologin; end if;
      if to_regrole('authenticated') is null then
        create role authenticated nologin; end if;
      if to_regrole('service_role') is null then
        create role service_role nologin; end if;
      if to_regrole('pgrst_local') is null then
        create role pgrst_local login password 'wetudy_disposable_local_2026';
      end if;
    end $$;""")
    psql(test_url, "grant anon, authenticated to pgrst_local")
    psql(test_url, "grant usage on schema public to anon, authenticated")
    for table in TABLES:
        psql(test_url, "create table public." + table +
             " (id uuid primary key, owner_id uuid not null, label text)")
        psql(test_url, "insert into public." + table +
             " values ('" + OWNER + "','" + OWNER + "','own'),('"
             + OTHER + "','" + OTHER + "','other')")
        psql(test_url, "alter table public." + table + " enable row level security")
        # Mirror verified read-only *production catalogue* ACL semantics:
        # agreement has anon/auth SELECT+MAINTAIN, four other targets have
        # anon/auth SELECT+INSERT+UPDATE+DELETE, service_role has ALL.
        # RLS still has zero anon/public policies, so writes are denied.
        psql(test_url, "grant select on public." + table +
             " to anon,authenticated,service_role")
        if table == "agreements":
            psql(test_url, "grant maintain on public." + table +
                 " to anon,authenticated")
        else:
            psql(test_url, "grant insert,update,delete on public." + table +
                 " to anon,authenticated")
        psql(test_url, "grant all privileges on public." + table +
             " to service_role")
        psql(test_url, "create policy owner_only on public." + table +
             " for select to authenticated using "
             "(owner_id = (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub')::uuid)")

    # Synthetic representation of a live security_invoker view dependency.
    psql(test_url, "create view public.demand_opportunities_30d "
         "with (security_invoker = true) as select id, owner_id "
         "from public.demand_requests")
    psql(test_url, "grant select on public.demand_opportunities_30d "
         "to anon, authenticated")

    docker_cmd = [
        "docker", "run", "--rm", "-d", "--network", "host", "--name", CONTAINER,
        "-e", "PGRST_DB_URI=postgres://pgrst_local:" + FAKE_PASSWORD +
              "@127.0.0.1:5432/" + TEST_DB,
        "-e", "PGRST_DB_SCHEMAS=public",
        "-e", "PGRST_DB_ANON_ROLE=anon",
        "-e", "PGRST_JWT_SECRET=" + FAKE_JWT_SECRET,
        "-e", "PGRST_SERVER_HOST=127.0.0.1",
        "-e", "PGRST_SERVER_PORT=" + str(PORT),
        IMAGE
    ]
    run(docker_cmd, timeout=110)
    container_started = True

    ready = False
    for _ in range(35):
        try:
            status, rows = get(TABLES[0])
            if status == 200 and rows == []:
                ready = True
                break
        except (URLError, TimeoutError, ValueError):
            pass
        time.sleep(1)
    if not ready:
        details = run(["docker", "logs", "--tail", "35", CONTAINER])[1]
        raise AssertionError("Local PostgREST did not become ready: " + details[-500:])

    # A rollback script is NOT allowed before the matching revoke.
    matrix_before = acl_fingerprint()
    if not all(row["select"] for row in matrix_before):
        raise AssertionError("Baseline grants missing before rollback drill")
    for row in matrix_before:
        if row["role"] in ("anon", "authenticated"):
            table = row["relation"]
            for op in ("insert", "update", "delete"):
                expected = table != "agreements"
                if row[op] != expected:
                    raise AssertionError("Local synthetic baseline does not match "
                                         "read-only observed production DML grants")
            if row["maintain"] != (table == "agreements"):
                raise AssertionError("Local synthetic baseline misses observed "
                                     "anon/auth MAINTAIN privilege")
        elif row["role"] == "service_role":
            if not all(row[op] for op in ("select","insert","update",
                                          "delete","maintain")):
                raise AssertionError("Local service_role baseline privileges drifted")
    rollback_early = run([
        "psql", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1",
        "--dbname", test_url, "-f", str(ROLLBACK)
    ], ok=False)
    if "Rollback blocked: anon already has SELECT" not in rollback_early[1]:
        raise AssertionError("Expected fail-closed rollback preflight")
    if acl_fingerprint() != matrix_before:
        raise AssertionError("Early rollback unexpectedly changed grants")
    check_rows(expected_revoke=False)

    psql(test_url, file=PROPOSAL)
    matrix_revoked = acl_fingerprint()
    for original, revoked in zip(matrix_before, matrix_revoked):
        expected = dict(original)
        if expected["role"] == "anon":
            expected["select"] = False
        if revoked != expected:
            raise AssertionError("REVOKE changed more than five anon SELECT grants: "
                                 + str(revoked["relation"]))
    check_rows(expected_revoke=True)

    # Simulate compensating action after the actual five-table change:
    # five grants only, restoring original HTTP status (42501 -> 200/empty).
    psql(test_url, file=ROLLBACK)
    matrix_restored = acl_fingerprint()
    if matrix_restored != matrix_before:
        raise AssertionError("Rollback failed to restore EXACT original "
                             "effective permission matrix or RLS")
    check_rows(expected_revoke=False)
    if psql(test_url, "select count(*) from pg_class c join pg_namespace n "
            "on n.oid=c.relnamespace where n.nspname='public' and "
            "c.relname in ('agreements','demand_requests','profiles',"
            "'saved_searches','schools') and c.relrowsecurity") != "5":
        raise AssertionError("RLS turned off in PostgREST fixture")
    print("PASS: local PostgREST five-table rollback drill: guest HTTP "
          "200/empty -> 42501 -> 200/empty; invoker view follows same "
          "status sequence; owners retain isolated JWT rows in all phases; "
          "original 15-role ACL/RLS matrix restored exactly; early rollback "
          "rejected without changes.")
finally:
    if container_started:
        run(["docker", "rm", "-f", CONTAINER], timeout=20)
    psql(source, "drop database if exists " + TEST_DB + " with (force)")
