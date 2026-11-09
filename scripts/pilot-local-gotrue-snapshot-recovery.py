#!/usr/bin/env python3
"""Selective logical recovery of REAL local GoTrue rows with synthetic QA users.

The source is a disposable Supabase CLI PostgreSQL, NEVER hosted production.
Only whitelisted Auth fields, profiles, and student rows are restored into a
second local database. This does NOT re-create a working GoTrue server/session.
"""
import base64
import csv
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import secrets
import subprocess
import tempfile
from urllib.parse import urlsplit, urlunsplit

SOURCE = os.environ.get("LOCAL_DB_URL", "")
parsed = urlsplit(SOURCE)
if parsed.scheme not in ("postgres", "postgresql") or parsed.hostname not in ("127.0.0.1", "localhost", "::1") or parsed.path != "/postgres":
    raise SystemExit("Refusing nonlocal GoTrue snapshot source")
TARGET_DB = "wetudy_qa_local_gotrue_restored"
TARGET = urlunsplit((parsed.scheme, parsed.netloc, "/" + TARGET_DB, "", ""))
PASSWORD_ENV = "WETUDY_QA_LOCAL_ENCRYPTION_PASSWORD"
EMAILS = ("qa-email-pkce-family@example.invalid", "qa-authform-family@example.invalid")


def cmd(args, database=SOURCE, data=None, env=None, check=True):
    return subprocess.run(args, input=data, text=True, capture_output=True,
                          check=check, env=env, timeout=80)


def sql(statement, database=SOURCE):
    result = cmd(["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
                  "--dbname", database, "-c", statement])
    return result.stdout.strip()


def rows(statement):
    return json.loads(sql("select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)::text "
                          "from (" + statement + ") as x"))


def copy_rows(table, columns, records):
    output = io.StringIO()
    writer = csv.writer(output)
    for record in records:
        writer.writerow([record[column] for column in columns])
    command = ("COPY " + table + " (" + ",".join(columns) + ") "
               "FROM STDIN WITH (FORMAT csv)")
    cmd(["psql", "-X", "-v", "ON_ERROR_STOP=1", "--dbname", TARGET,
         "-c", command], database=TARGET, data=output.getvalue())


def main():
    # Only users created by the QA mail confirmation scripts can be exported.
    users = rows(
        "select id::text as id,email,encrypted_password as password_hash,"
        "(email_confirmed_at is not null) as confirmed "
        "from auth.users where email in (" + ",".join("'" + e + "'" for e in EMAILS) + ")"
    )
    if (len(users) != len(EMAILS) or {u["email"] for u in users} != set(EMAILS)
            or not all(u["confirmed"] and u["password_hash"] for u in users)):
        raise AssertionError("Both local GoTrue QA families must be confirmed and password-backed")
    user_ids = {u["id"] for u in users}
    identities = rows(
        "select user_id::text as user_id, provider, provider_id "
        "from auth.identities where user_id in ("
        "select id from auth.users where email in (" +
        ",".join("'" + e + "'" for e in EMAILS) + "))"
    )
    profiles = rows(
        "select id::text as id, school_id::text as school_id,"
        " first_name, last_name, postal_code from public.profiles"
        " where id in (select id from auth.users where email in (" +
        ",".join("'" + e + "'" for e in EMAILS) + "))"
    )
    students = rows(
        "select id::text as id, owner_user_id::text as owner_user_id,"
        " alias, grade_level, active from public.account_students"
        " where owner_user_id in (select id from auth.users where email in (" +
        ",".join("'" + e + "'" for e in EMAILS) + "))"
    )
    if len(profiles) != len(users) or not students or len(identities) < len(users):
        raise AssertionError("Local Auth/profile/student/identity references incomplete")
    if any(r["user_id"] not in user_ids for r in identities):
        raise AssertionError("Unexpected identity owner")
    if any(r["owner_user_id"] not in user_ids for r in students):
        raise AssertionError("Unexpected student owner")
    for user_id in user_ids:
        if not any(r["user_id"] == user_id for r in identities):
            raise AssertionError("One local GoTrue user has no identity")
        if not any(r["owner_user_id"] == user_id for r in students):
            raise AssertionError("One local GoTrue user has no linked student")
        if not any(r["id"] == user_id for r in profiles):
            raise AssertionError("One local GoTrue user has no profile")
    if sql("select count(*) from public.user_roles") != "0":
        raise AssertionError("Local QR rehearsal must grant no administrative roles")

    # Two deterministic synthetic Storage objects attached to REAL local
    # GoTrue identities; no hosted Storage bytes are read or contacted.
    objects = []
    for user in users:
        is_first = user["email"] == EMAILS[0]
        bucket = "listing-photos" if is_first else "chat-attachments"
        name = user["id"] + ("/example.webp" if is_first else "/receipt.txt")
        payload = (b"WETUDY-SYNTHETIC-IMAGE-BYTES" if is_first
                   else b"WETUDY-SYNTHETIC-MESSAGE-BYTES")
        objects.append({
            "bucket": bucket, "path": name, "owner_user_id": user["id"],
            "size": len(payload), "sha256": hashlib.sha256(payload).hexdigest(),
            "bytes_base64": base64.b64encode(payload).decode("ascii")
        })
    archive = {"users": users, "identities": identities,
               "profiles": profiles, "students": students,
               "storage_refs": [
                   {key: item[key] for key in ("bucket", "path", "owner_user_id", "sha256")}
                   for item in objects
               ], "storage_objects": objects}
    with tempfile.TemporaryDirectory(prefix="wetudy-local-auth-restore-") as temporary:
        directory = Path(temporary)
        plain = directory / "auth-synthetic-backup.json"
        encrypted = directory / "auth-synthetic-backup.json.enc"
        recovered = directory / "auth-restored.json"
        plain.write_text(json.dumps(archive, sort_keys=True), encoding="utf8")
        expected_sha = hashlib.sha256(plain.read_bytes()).hexdigest()
        env = dict(os.environ, **{PASSWORD_ENV: secrets.token_hex(32)})
        args = ["openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-iter", "200000"]
        cmd(args + ["-in", str(plain), "-out", str(encrypted),
                    "-pass", "env:" + PASSWORD_ENV], env=env)
        encrypted_sha = hashlib.sha256(encrypted.read_bytes()).hexdigest()
        if not encrypted_sha or encrypted.stat().st_size < 40:
            raise AssertionError("Auth artifact encryption failed")
        plain.unlink()
        if hashlib.sha256(encrypted.read_bytes()).hexdigest() != encrypted_sha:
            raise AssertionError("Encrypted Auth backup was altered")
        corrupted = bytearray(encrypted.read_bytes())
        corrupted[-2] ^= 0x01
        if hashlib.sha256(corrupted).hexdigest() == encrypted_sha:
            raise AssertionError("Tampering detection must catch modified ciphertext")
        wrong = dict(env, **{PASSWORD_ENV: "wrong-local-qa-password"})
        wrong_out = directory / "auth-wrong-password.json"
        negative = cmd(["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2",
                        "-iter", "200000", "-in", str(encrypted),
                        "-out", str(wrong_out), "-pass", "env:" + PASSWORD_ENV],
                       env=wrong, check=False)
        if negative.returncode == 0 and wrong_out.exists() and (
                hashlib.sha256(wrong_out.read_bytes()).hexdigest() == expected_sha):
            raise AssertionError("Wrong decryption password recovered authentic content")
        wrong_out.unlink(missing_ok=True)

        cmd(["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2",
             "-iter", "200000", "-in", str(encrypted), "-out", str(recovered),
             "-pass", "env:" + PASSWORD_ENV], env=env)
        if hashlib.sha256(recovered.read_bytes()).hexdigest() != expected_sha:
            raise AssertionError("Recovered Auth snapshot checksum mismatch")
        source = json.loads(recovered.read_text(encoding="utf8"))
        # A NEW database is used; never write recovered rows into the live GoTrue
        # database, even when that source itself is already a local fixture.
        sql("create database " + TARGET_DB)
        try:
            sql("""
            create schema qa_restored_auth;
            create table qa_restored_auth.users(
                id uuid primary key, email text not null unique,
                password_hash text not null, confirmed boolean not null);
            create table qa_restored_auth.identities(
                user_id uuid not null references qa_restored_auth.users(id),
                provider text not null, provider_id text not null);
            create table qa_restored_auth.profiles(
                id uuid primary key references qa_restored_auth.users(id),
                school_id text, first_name text, last_name text, postal_code text);
            create table qa_restored_auth.students(
                id uuid primary key, owner_user_id uuid not null
                references qa_restored_auth.users(id), alias text,
                grade_level text, active boolean);
            create table qa_restored_auth.storage_refs(
                bucket text not null, path text not null, owner_user_id uuid not null
                references qa_restored_auth.users(id),
                sha256 text not null, primary key(bucket,path));
            """, TARGET)
            for table, columns in (
                ("users", ("id", "email", "password_hash", "confirmed")),
                ("identities", ("user_id", "provider", "provider_id")),
                ("profiles", ("id", "school_id", "first_name", "last_name", "postal_code")),
                ("students", ("id", "owner_user_id", "alias", "grade_level", "active")),
                ("storage_refs", ("bucket", "path", "owner_user_id", "sha256"))
            ):
                copy_rows("qa_restored_auth." + table, columns, source[table])
            restored = {
                "users": json.loads(sql("select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)"
                                        " from (select id::text as id,email,password_hash,confirmed "
                                        "from qa_restored_auth.users) x", TARGET)),
                "identities": json.loads(sql("select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)"
                                             " from (select user_id::text as user_id,provider,provider_id "
                                             "from qa_restored_auth.identities) x", TARGET)),
                "profiles": json.loads(sql("select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)"
                                           " from (select id::text as id,school_id,first_name,last_name,postal_code "
                                           "from qa_restored_auth.profiles) x", TARGET)),
                "students": json.loads(sql("select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)"
                                           " from (select id::text as id,owner_user_id::text as owner_user_id,"
                                           "alias,grade_level,active from qa_restored_auth.students) x", TARGET)),
                "storage_refs": json.loads(sql("select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)"
                                               " from (select bucket,path,"
                                               "owner_user_id::text as owner_user_id,sha256 "
                                               "from qa_restored_auth.storage_refs) x", TARGET))
            }
            for key in ("users", "identities", "profiles", "students", "storage_refs"):
                if sorted(source[key], key=lambda item: json.dumps(item, sort_keys=True)) != sorted(
                        restored[key], key=lambda item: json.dumps(item, sort_keys=True)):
                    raise AssertionError("Local real GoTrue linked snapshot differs: " + key)
            if len(source["storage_objects"]) != len(users):
                raise AssertionError("Missing simulated Storage objects")
            restore_root = directory / "restored-storage"
            for item in source["storage_objects"]:
                if item["owner_user_id"] not in user_ids or item["bucket"] not in (
                        "listing-photos", "chat-attachments"):
                    raise AssertionError("Untrusted restored storage ownership/bucket")
                parts = PurePosixPath(item["path"])
                if parts.is_absolute() or any(part in (".", "..") for part in parts.parts) or (
                        not parts.parts or parts.parts[0] != item["owner_user_id"]):
                    raise AssertionError("Untrusted restored storage object path")
                saved = restore_root / item["bucket"] / parts
                saved.parent.mkdir(parents=True, exist_ok=True)
                payload = base64.b64decode(item["bytes_base64"], validate=True)
                saved.write_bytes(payload)
                if (len(payload) != item["size"] or
                        hashlib.sha256(saved.read_bytes()).hexdigest() != item["sha256"]):
                    raise AssertionError("Restored synthetic Storage bytes failed checksum")
                matching = [ref for ref in restored["storage_refs"]
                            if ref["bucket"] == item["bucket"] and ref["path"] == item["path"]]
                if len(matching) != 1 or matching[0]["sha256"] != item["sha256"]:
                    raise AssertionError("Restored Storage reference lost byte integrity")
            print("PASS cross-family synthetic Storage bytes tied to REAL local GoTrue owner ids "
                  "and restored selective Auth/DB reference rows; two objects match SHA256.")
            print("PASS TWO confirmed REAL local GoTrue QA families: Auth user+identity snapshot, "
                  "profiles and students encrypted and recovered to DISTINCT local DB; "
                  "SHA256, UUID relationships and record parity verified.")
            print("LIMIT: selective logical tables, not a bootable GoTrue Auth restore, "
                  "synthetic Storage bytes, not hosted Storage or full disaster recovery.")
        finally:
            sql("drop database if exists " + TARGET_DB + " with (force)")


if __name__ == "__main__":
    main()
