#!/usr/bin/env python3
"""Validate a FULL disposable local Supabase PostgreSQL dump/restore.

This is a logical database clone only. It does NOT copy hosted Storage bytes,
reconfigure SMTP/API/JWT secrets, or start a replacement GoTrue service.
Never use on remotely hosted PostgreSQL.
"""
import os
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import urlsplit, urlunsplit

SOURCE = os.getenv("LOCAL_DB_URL", "")
parsed = urlsplit(SOURCE)
if (parsed.scheme not in ("postgres", "postgresql")
        or parsed.hostname not in ("localhost", "127.0.0.1", "::1")
        or parsed.path != "/postgres"):
    raise SystemExit("Refusing full DB drill without exact local Supabase /postgres source")
DEST_NAME = "wetudy_qa_full_restore_only"
DEST = urlunsplit((parsed.scheme, parsed.netloc, "/" + DEST_NAME, "", ""))


def call(*argv):
    return subprocess.run(argv, text=True, capture_output=True,
                          check=True, timeout=140).stdout.strip()


def sql(connection, statement):
    return call("psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
                "--dbname", connection, "-c", statement)


def snapshot(connection):
    checks = (
        "select count(*) from auth.users",
        "select count(*) from auth.identities",
        "select count(*) from public.profiles",
        "select count(*) from public.account_students",
        "select count(*) from public.user_roles",
        "select count(*) from public.schools",
        "select count(*) from public.school_directory",
        "select string_agg(id::text || ':' || email, ',' order by email)"
        " from auth.users where email like '%@example.invalid'",
        "select string_agg(user_id::text || ':' || provider, ',' order by user_id,provider)"
        " from auth.identities",
        "select string_agg(id::text || ':' || coalesce(school_id::text,''), ',' order by id)"
        " from public.profiles",
        "select string_agg(id::text || ':' || owner_user_id::text, ',' order by id)"
        " from public.account_students",
    )
    return tuple(sql(connection, statement) for statement in checks)


def main():
    expected_users = (
        "qa-email-pkce-family@example.invalid",
        "qa-authform-family@example.invalid",
        "qa-student-age-gate@example.invalid",
    )
    original = snapshot(SOURCE)
    if int(original[0]) < len(expected_users) or int(original[1]) < len(expected_users):
        raise AssertionError("Original local GoTrue accounts and identities missing")
    if any(sql(SOURCE, "select count(*) from auth.users where email='" + address +
               "' and email_confirmed_at is not null") != "1"
           for address in expected_users):
        raise AssertionError("Expected confirmed local GoTrue QA family missing")
    if sql(SOURCE, "select count(*) from pg_database where datname='" + DEST_NAME + "'") != "0":
        raise RuntimeError("Refusing to overwrite an existing restored local database")

    with tempfile.TemporaryDirectory(prefix="wetudy-local-full-pg-restore-") as directory:
        archive = Path(directory) / "full-supabase-local.dump"
        call("pg_dump", "--format=custom", "--no-owner", "--no-acl",
             "--dbname", SOURCE, "--file", str(archive))
        if archive.stat().st_size < 4096:
            raise AssertionError("Full Supabase PostgreSQL local archive appears empty")
        sql(SOURCE, "create database " + DEST_NAME)
        try:
            # Do NOT weaken the exit status: schema dependency or restore errors
            # should keep pilot DR in NO-GO instead of producing a false green.
            call("pg_restore", "--exit-on-error", "--no-owner", "--no-acl",
                 "--dbname", DEST, str(archive))
            recovered = snapshot(DEST)
            if original != recovered:
                raise AssertionError("Full local database clone differs in Auth, profile, student or school references")
            if sql(DEST, "select count(*) from auth.users where email_confirmed_at is not null") != original[0]:
                # This fixture expects every QA account to have confirmed email.
                raise AssertionError("Full local clone lost a confirmed Auth account")
            if sql(DEST, "select count(*) from public.user_roles") != "0":
                raise AssertionError("Restored test accounts unexpectedly have privileged roles")
            print("PASS full LOCAL Supabase PostgreSQL logical dump/restore: "
                  "auth.users, auth.identities, profiles, students, roles, schools and directory parity.")
            print("LIMIT: DOES NOT prove running GoTrue on the clone, storage object byte restoration, "
                  "hosted SMTP or a production disaster recovery.")
        finally:
            sql(SOURCE, "drop database if exists " + DEST_NAME + " with (force)")


if __name__ == "__main__":
    main()
