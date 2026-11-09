#!/usr/bin/env python3
"""Disposable PostgreSQL + Storage-bytes recovery drill using ONLY invented data.

Uses local PostgreSQL, not hosted Supabase; qa_pilot_auth is NOT real GoTrue Auth.
This is NOT a certification of full production Auth+DB+Storage recovery.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
from urllib.parse import urlsplit, urlunsplit
from runpy import run_path

SOURCE = os.environ.get("LOCAL_RESTORE_URL", "")
parsed = urlsplit(SOURCE)
if (parsed.scheme not in ("postgres", "postgresql") or
    parsed.hostname not in ("localhost", "127.0.0.1", "::1") or
    parsed.path != "/wetudy_pilot_dr_source"):
    raise SystemExit("Refusing nonlocal or unexpected synthetic source PostgreSQL database")
TARGET = urlunsplit((parsed.scheme, parsed.netloc,
                     "/wetudy_pilot_dr_restored", "", ""))
ROOT = Path(__file__).resolve().parent
verify_archive = run_path(str(ROOT / "verify-pilot-storage-restore.py"))["validate_archive"]


def run(*command):
    return subprocess.run(command, check=True, capture_output=True, text=True,
                          timeout=90).stdout.strip()


def query(database, sql):
    return run("psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
               "--dbname", database, "-c", sql)


schema = """
CREATE SCHEMA qa_pilot_auth;
CREATE SCHEMA qa_pilot_app;
CREATE TABLE qa_pilot_auth.accounts(id uuid PRIMARY KEY, email text NOT NULL);
CREATE TABLE qa_pilot_app.profiles(
  id uuid PRIMARY KEY REFERENCES qa_pilot_auth.accounts(id),
  school_id uuid NULL);
CREATE TABLE qa_pilot_app.students(
  id uuid PRIMARY KEY, owner_user_id uuid NOT NULL REFERENCES qa_pilot_app.profiles(id),
  grade_level text NOT NULL);
CREATE TABLE qa_pilot_app.storage_refs(
  bucket text NOT NULL, path text NOT NULL, owner_user_id uuid NOT NULL,
  sha256 text NOT NULL, PRIMARY KEY(bucket,path));
INSERT INTO qa_pilot_auth.accounts VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','parent-a@example.invalid'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','parent-b@example.invalid');
INSERT INTO qa_pilot_app.profiles VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',NULL);
INSERT INTO qa_pilot_app.students VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','3 Primaria');
"""


def snapshot(url):
    statements = (
        "select id||'|'||email from qa_pilot_auth.accounts order by id",
        "select id||'|'||coalesce(school_id::text,'') from qa_pilot_app.profiles order by id",
        "select id||'|'||owner_user_id||'|'||grade_level from qa_pilot_app.students order by id",
        "select bucket||'/'||path||'|'||owner_user_id||'|'||sha256 "
        "from qa_pilot_app.storage_refs order by bucket,path",
    )
    return tuple(query(url, statement) for statement in statements)


def tar_entry(tar, name, data):
    info = tarfile.TarInfo("./" + name)
    info.size = len(data)
    tar.addfile(info, io.BytesIO(data))


def main():
    fixtures = {
        ("listing-photos", "parent-a/example.webp"): b"FAKE-WETUDY-PHOTO-2026",
        ("chat-attachments", "parent-b/notice.txt"): b"FAKE-WETUDY-CHAT-2026",
    }
    query(SOURCE, schema)
    for (bucket, name), data in fixtures.items():
        digest = hashlib.sha256(data).hexdigest()
        owner = ("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
                 if bucket == "listing-photos" else
                 "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
        query(SOURCE,
              "insert into qa_pilot_app.storage_refs values "
              f"('{bucket}','{name}','{owner}','{digest}')")
    original = snapshot(SOURCE)
    if len(original[0].splitlines()) != 2 or len(original[2].splitlines()) != 1:
        raise AssertionError("Synthetic source rows are incomplete")
    with tempfile.TemporaryDirectory(prefix="wetudy-integrated-dr-") as directory:
        directory = Path(directory)
        backup = directory / "pilot-db.dump"
        archive = directory / "pilot-objects.tar.gz"
        run("pg_dump", "--dbname", SOURCE, "-Fc", "--no-owner", "--no-acl",
            "--schema=qa_pilot_auth", "--schema=qa_pilot_app",
            "-f", str(backup))
        if not backup.stat().st_size:
            raise AssertionError("Empty database archive")
        manifest = {
            "version": 1,
            "buckets": ["listing-photos", "chat-attachments"],
            "fileCount": len(fixtures),
            "totalBytes": sum(map(len, fixtures.values())),
            "files": [
                {"bucket": bucket, "path": name, "size": len(data),
                 "sha256": hashlib.sha256(data).hexdigest()}
                for (bucket, name), data in fixtures.items()
            ],
        }
        with tarfile.open(archive, "w:gz") as tar:
            for name in ("./", "./listing-photos/", "./chat-attachments/"):
                info = tarfile.TarInfo(name)
                info.type = tarfile.DIRTYPE
                tar.addfile(info)
            for (bucket, name), data in fixtures.items():
                tar_entry(tar, bucket + "/" + name, data)
            tar_entry(tar, "manifest.json", json.dumps(manifest).encode())
        verify_archive(archive)
        # A second, distinct LOCAL database must be created before restoration.
        query(SOURCE, "create database wetudy_pilot_dr_restored")
        run("pg_restore", "--exit-on-error", "--no-owner", "--no-acl",
            "--dbname", TARGET, str(backup))
        recovered = snapshot(TARGET)
        if recovered != original:
            raise AssertionError("Recovered PostgreSQL rows differ from source")
        if query(TARGET,"select count(*) from qa_pilot_app.profiles where school_id is not null") != "0":
            raise AssertionError("Unexpected active school membership in recovery")
        with tarfile.open(archive, "r:gz") as tar:
            for (bucket, name), original_bytes in fixtures.items():
                member = tar.extractfile("./" + bucket + "/" + name)
                if member is None or member.read() != original_bytes:
                    raise AssertionError("Storage object bytes changed across recovery")
        print("PASS synthetic integrated DR: two account surrogates, two profiles, "
              "one student, two storage objects; local pg_dump/pg_restore and "
              "byte-for-byte SHA256 verified.")
        print("LIMIT: synthetic account surrogates are NOT Supabase GoTrue users; "
              "this is NOT a full hosted Auth/DB/Storage restore.")


if __name__ == "__main__":
    main()
