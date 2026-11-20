#!/usr/bin/env python3
"""Supabase Realtime / Postgres Changes integration in disposable Docker ONLY.

Two synthetic agreement participants must receive REAL WebSocket WAL updates
before and after the exact five-table anon SELECT proposal. Third party/guest
must never receive agreement row data. No actual Supabase credentials or DB.
"""
import base64
import hashlib
import hmac
import json
import os
import socket
import subprocess
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = Path(__file__).resolve().parent
PROPOSAL = BASE / "pilot-anon-select-wave1-local-only.sql"
ROLLBACK = BASE / "pilot-anon-select-rollback-local-only.sql"
WS_TEST = BASE / "pilot-anon-realtime-live-client.mjs"
PG_NAME = "wetudy-realtime-test-pg17"
RT_NAME = "wetudy-realtime-test-srv"
PG_PORT = 5543
RT_PORT = 4107
DB_NAME = "wetudy_pilot_anon_select_wave1"
LOCAL_PW = "wetudy_local_realtime_pg17_only_password"
JWT_SECRET = "wetudy_realtime_synthetic_secret_local_only_2026_123456789"
RT_IMAGE = "supabase/realtime:v2.148.3"
PG_IMAGE = "postgres:17"
CONVERSATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
BUYER = "11111111-1111-4111-8111-111111111111"
SELLER = "22222222-2222-4222-8222-222222222222"
TARGETS = ("agreements", "demand_requests", "profiles", "saved_searches", "schools")

# The runner never accepts a project URL, network address, user DB or cloud key.
if any(os.environ.get(k) for k in
       ("SUPABASE_DB_URL", "DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF")):
    raise SystemExit("Refusing any remote Supabase credential in Realtime QA")
if (WS_TEST.resolve().parent != BASE.resolve() or not PROPOSAL.exists()
        or not ROLLBACK.exists()):
    raise SystemExit("Refusing unexpected test files")
if socket.gethostbyname("realtime-dev.localhost") != "127.0.0.1":
    raise SystemExit("Realtime synthetic tenant must resolve to loopback only")


def command(args, *, timeout=60, allow_fail=False):
    output = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if output.returncode and not allow_fail:
        raise AssertionError("Disposable fixture failed: " + " ".join(args[:2]) +
                             " " + output.stderr[-1300:])
    return output


def in_use(name):
    result = command(["docker", "ps", "-a", "--filter", "name=^/" + name + "$",
                      "--format", "{{.Names}}"])
    return name in result.stdout.splitlines()


def postgres(sql, *, file=None):
    args = ["docker", "exec", PG_NAME, "psql", "-X", "-q", "-t", "-A",
            "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", DB_NAME]
    args += ["-f", str(file)] if file is not None else ["-c", sql]
    return command(args, timeout=35).stdout.strip()


def pgfile(path):
    # psql -f inside Docker cannot see the GitHub checkout; stream via stdin.
    text = path.read_text(encoding="utf8")
    result = subprocess.run(["docker", "exec", "-i", PG_NAME, "psql", "-X",
                             "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1",
                             "-U", "postgres", "-d", DB_NAME],
                            input=text, capture_output=True, text=True, timeout=45)
    if result.returncode:
        raise AssertionError("Local-only SQL proposal failed: " + result.stderr[-950:])


def token(role):
    def enc(obj):
        return base64.urlsafe_b64encode(json.dumps(obj, separators=(",", ":")
                                        ).encode()).rstrip(b"=").decode()
    body = enc({"alg": "HS256", "typ": "JWT"}) + "." + enc({
        "role": role, "iss": "wetudy-synthetic-only",
        "exp": int(time.time()) + 600})
    sig = base64.urlsafe_b64encode(hmac.new(JWT_SECRET.encode(), body.encode(),
                                           hashlib.sha256).digest()).rstrip(b"=").decode()
    return body + "." + sig


def healthcheck():
    url = "http://127.0.0.1:" + str(RT_PORT) + "/api/tenants/realtime-dev/health"
    request = Request(url, headers={"Authorization": "Bearer " + token("service_role")})
    try:
        with urlopen(request, timeout=3) as response:
            return response.status in (200, 204)
    except (HTTPError, URLError, TimeoutError, ConnectionError):
        # Fresh local Realtime boot may close a socket while replacing listeners.
        # Retry startup readiness, but never treat this as a passed WebSocket test.
        return False


def initialize():
    ddl = """
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE ROLE supabase_admin LOGIN SUPERUSER PASSWORD 'wetudy_local_realtime_pg17_only_password';
    CREATE ROLE supabase_realtime_admin NOLOGIN;
    CREATE ROLE dashboard_user NOLOGIN;
    GRANT anon,authenticated,service_role TO supabase_realtime_admin;
    CREATE SCHEMA auth;
    CREATE SCHEMA extensions;
    CREATE SCHEMA realtime;
    CREATE SCHEMA _realtime AUTHORIZATION supabase_admin;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role,supabase_realtime_admin;
    GRANT CREATE ON DATABASE wetudy_pilot_anon_select_wave1 TO supabase_realtime_admin;
    GRANT CREATE ON SCHEMA public TO supabase_realtime_admin;
    GRANT USAGE ON SCHEMA auth,extensions TO supabase_realtime_admin;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    GRANT USAGE ON SCHEMA realtime TO anon,authenticated,service_role;
    GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;
    GRANT CREATE,USAGE ON SCHEMA _realtime TO supabase_realtime_admin;
    ALTER ROLE supabase_realtime_admin SET search_path TO public,extensions,realtime;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT (coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
                       nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub'))::uuid
    $$;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,supabase_realtime_admin;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,
                      '{}'::jsonb)
    $$;
    GRANT EXECUTE ON FUNCTION auth.jwt() TO supabase_realtime_admin;
    CREATE TABLE public.agreements (
      id uuid PRIMARY KEY, conversation_id uuid NOT NULL,
      buyer_id uuid NOT NULL, seller_id uuid NOT NULL,
      status text NOT NULL, updated_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.agreements TO anon,authenticated,service_role;
    CREATE POLICY agreement_participants ON public.agreements
      FOR SELECT TO authenticated
      USING (buyer_id = (SELECT auth.uid()) OR seller_id = (SELECT auth.uid()));
    CREATE TABLE public.demand_requests(id uuid PRIMARY KEY,owner_id uuid);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,owner_id uuid);
    CREATE TABLE public.saved_searches(id uuid PRIMARY KEY,owner_id uuid);
    CREATE TABLE public.schools(id uuid PRIMARY KEY,owner_id uuid);
    ALTER TABLE public.demand_requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.demand_requests,public.profiles,public.saved_searches,
                    public.schools TO anon,authenticated,service_role;
    INSERT INTO public.agreements(id,conversation_id,buyer_id,seller_id,status)
    VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
           'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
           '11111111-1111-4111-8111-111111111111',
           '22222222-2222-4222-8222-222222222222','proposed');
    CREATE PUBLICATION supabase_realtime FOR TABLE public.agreements;
    """
    postgres(ddl)
    state = postgres("select current_setting('wal_level')")
    if state != "logical":
        raise AssertionError("Realtime requires PostgreSQL WAL logical; observed " + state)
    if postgres("select count(*) from pg_publication_tables "
                "where pubname='supabase_realtime' and tablename='agreements'") != "1":
        raise AssertionError("Missing fake agreement publication")


for name in (PG_NAME, RT_NAME):
    if in_use(name):
        raise SystemExit("Refusing to overwrite existing Docker QA container: " + name)

started = []
try:
    command(["docker", "run", "--rm", "-d", "--name", PG_NAME,
             "-e", "POSTGRES_USER=postgres",
             "-e", "POSTGRES_PASSWORD=" + LOCAL_PW,
             "-e", "POSTGRES_DB=" + DB_NAME,
             "-p", "127.0.0.1:" + str(PG_PORT) + ":5432",
             PG_IMAGE, "-c", "wal_level=logical",
             "-c", "output_plugin_libraries=wal2json",
             "-c", "max_replication_slots=10", "-c", "max_wal_senders=10"], timeout=130)
    started.append(PG_NAME)
    ready = False
    for _ in range(40):
        if command(["docker", "exec", PG_NAME, "pg_isready", "-h", "127.0.0.1",
                    "-U", "postgres", "-d", DB_NAME], allow_fail=True).returncode == 0:
            ready = True
            break
        time.sleep(1)
    if not ready:
        raise AssertionError("Disposable PG17 failed startup")
    # The Supabase Realtime postgres_cdc_rls poller requires wal2json;
    # stock postgres:17 does not ship that logical decoding plugin.
    # Install inside this disposable container, never on the runner or prod DB.
    command(["docker", "exec", "-u", "root", PG_NAME, "bash", "-lc",
             "apt-get update -qq && DEBIAN_FRONTEND=noninteractive "
             "apt-get install -y -qq postgresql-17-wal2json"], timeout=180)
    plugin = postgres("select slot_name from "
                      "pg_create_logical_replication_slot("
                      "'wetudy_wal2json_preflight', 'wal2json', true)")
    if "wetudy_wal2json_preflight" not in plugin:
        raise AssertionError("Local wal2json plugin unavailable")
    initialize()

    command(["docker", "run", "--rm", "-d", "--network", "host", "--name", RT_NAME,
             "-e", "PORT=" + str(RT_PORT),
             "-e", "DB_HOST=127.0.0.1",
             "-e", "DB_PORT=" + str(PG_PORT),
             "-e", "DB_USER=supabase_admin",
             "-e", "DB_PASSWORD=" + LOCAL_PW,
             "-e", "DB_NAME=" + DB_NAME,
             "-e", "DB_ENC_KEY=1234567890123456",
             "-e", "DB_AFTER_CONNECT_QUERY=SET search_path TO _realtime",
             "-e", "API_JWT_SECRET=" + JWT_SECRET,
             "-e", "METRICS_JWT_SECRET=" + JWT_SECRET,
             "-e", "SECRET_KEY_BASE=wetudy-realtime-local-only-secret-key-base-2026-testing-only-123456789",
             "-e", "RELEASE_COOKIE=wetudylocaltestcookieeeeeeeeeeeeeeeeee",
             "-e", "ERL_AFLAGS=-proto_dist inet_tcp",
             "-e", "GEN_RPC_SOCKET_IP=127.0.0.1",
             "-e", "CLUSTER_STRATEGIES=",
             "-e", "APP_NAME=realtime",
             "-e", "SEED_SELF_HOST=true",
             "-e", "RUN_JANITOR=false",
             RT_IMAGE], timeout=160)
    started.append(RT_NAME)

    # Supabase Realtime v2.148.3 can report tenant HTTP health before
    # finishing the tenant's Ecto migrations. In particular its 20260707
    # migration references dashboard_user. Require the ACTUAL FINAL
    # 20261009120000 tenant migration marker from the pinned image, not a
    # healthcheck-only guess or a mere websocket CHANNEL_JOIN.
    ready = False
    migration = "not_checked"
    for _ in range(85):
        if healthcheck():
            present = postgres("select to_regclass("
                               "'realtime.schema_migrations') is not null")
            if present == "t":
                migration = postgres("select coalesce(max(version),0)::bigint "
                                     ">= 20261009120000 "
                                     "from realtime.schema_migrations")
                if migration == "t":
                    ready = True
                    break
            else:
                migration = "schema_migrations_not_yet_created"
        time.sleep(2)
    if not ready:
        output = command(["docker", "logs", "--tail", "95", RT_NAME],
                         allow_fail=True)
        log = output.stdout + output.stderr
        raise AssertionError("Local Realtime tenant migrations not ready: " +
                             str(migration) + " " + log[-8500:])
    print("PASS: pinned Realtime v2.148.3 tenant migrated through "
          "20261009120000 before WebSocket subscription")

    def check_phase(phase):
        # Tenant migration startup can briefly accept HTTP health while the
        # Phoenix WebSocket listener is reloading. Retry exactly ONCE only for
        # a transport failure before subscription. Never retry missing WAL,
        # permission errors, leaks, assertions or real delivery failures.
        for attempt in range(2):
            try:
                command(["node", str(WS_TEST), phase], timeout=125)
                return
            except Exception as error:
                if attempt == 0 and "transport failure" in str(error):
                    print("Local tenant transport startup raced migrations; "
                          "one fresh connection retry, delivery checks unchanged")
                    time.sleep(6)
                    continue
                logs_result = command(["docker", "logs", "--tail", "115", RT_NAME],
                                      allow_fail=True)
                logs = logs_result.stdout + logs_result.stderr
                slots = postgres("select coalesce(string_agg(slot_name||chr(58)||plugin||chr(58)||active::text, chr(44)),chr(45)) from pg_replication_slots")
                raise AssertionError("Isolated Realtime diagnostics, phase=" + phase +
                                     ", replication_slots=" + slots +
                                     ", server_logs_tail=" + logs[-8800:]) from error
        raise AssertionError("Local Realtime retry guard exhausted")

    check_phase("before")
    pgfile(PROPOSAL)
    for table in TARGETS:
        permitted = postgres("select has_table_privilege('anon',"
                             "'public." + table + "','SELECT')")
        if permitted != "f":
            raise AssertionError("Anonymous SELECT survived on " + table)
        auth = postgres("select has_table_privilege('authenticated',"
                        "'public." + table + "','SELECT')")
        if auth != "t":
            raise AssertionError("Authenticated SELECT removed from " + table)
    check_phase("after")

    # Third real-WAL phase: same pinned tenant and synthetic agreement, but
    # the five SELECT grants have been restored by the NAME-GUARDED QA SQL.
    # The anonymous JWT now has table SELECT but RLS must still block it.
    pgfile(ROLLBACK)
    for table in TARGETS:
        for role in ("anon", "authenticated", "service_role"):
            allowed = postgres("select has_table_privilege('" + role +
                               "','public." + table + "','SELECT')")
            if allowed != "t":
                raise AssertionError("Local rollback did not restore " + role +
                                     " SELECT on " + table)
        if postgres("select relrowsecurity from pg_class where oid='public." +
                    table + "'::regclass") != "t":
            raise AssertionError("RLS disabled during local Realtime rollback: " + table)
    check_phase("restored")

    print("PASS: REAL Realtime websocket postgres_changes delivered synthetic "
          "agreement updates ONLY to buyer/seller in THREE stages: original, "
          "after five-table anon revoke, and after local-only compensating "
          "five-table SELECT GRANT. Guest/outsider receive zero agreement "
          "records in every phase; local RLS remains enabled; no prod.")
finally:
    for name in reversed(started):
        command(["docker", "rm", "-f", name], timeout=25, allow_fail=True)
