#!/usr/bin/env python3
"""Disposable PostgreSQL + Storage-bytes recovery drill using ONLY invented data.

Uses local PostgreSQL, not hosted Supabase; qa_pilot_auth is NOT real GoTrue Auth.
This is NOT a certification of full production Auth+DB+Storage recovery.
"""
import hashlib
import io
import json
import os
import secrets
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
CREATE TABLE qa_pilot_app.listings(
  id uuid PRIMARY KEY, seller_id uuid NOT NULL REFERENCES qa_pilot_app.profiles(id),
  title text NOT NULL, status text NOT NULL);
CREATE TABLE qa_pilot_app.conversations(
  id uuid PRIMARY KEY, listing_id uuid NOT NULL REFERENCES qa_pilot_app.listings(id),
  buyer_id uuid NOT NULL REFERENCES qa_pilot_app.profiles(id),
  seller_id uuid NOT NULL REFERENCES qa_pilot_app.profiles(id));
CREATE TABLE qa_pilot_app.messages(
  id uuid PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES qa_pilot_app.conversations(id),
  sender_id uuid NOT NULL REFERENCES qa_pilot_app.profiles(id), body text NOT NULL);
CREATE TABLE qa_pilot_app.listing_offers(
  id uuid PRIMARY KEY, listing_id uuid NOT NULL REFERENCES qa_pilot_app.listings(id),
  buyer_id uuid NOT NULL REFERENCES qa_pilot_app.profiles(id),
  seller_id uuid NOT NULL REFERENCES qa_pilot_app.profiles(id),
  amount_cents integer NOT NULL, status text NOT NULL);
CREATE TABLE qa_pilot_app.agreements(
  id uuid PRIMARY KEY, offer_id uuid NOT NULL REFERENCES qa_pilot_app.listing_offers(id),
  buyer_id uuid NOT NULL REFERENCES qa_pilot_app.profiles(id),
  seller_id uuid NOT NULL REFERENCES qa_pilot_app.profiles(id), status text NOT NULL);
CREATE TABLE qa_pilot_app.storage_refs(
  bucket text NOT NULL, path text NOT NULL, owner_user_id uuid NOT NULL,
  sha256 text NOT NULL, PRIMARY KEY(bucket,path));
CREATE TABLE qa_pilot_app.listing_photos(
  id uuid PRIMARY KEY, listing_id uuid NOT NULL REFERENCES qa_pilot_app.listings(id),
  bucket text NOT NULL, path text NOT NULL,
  FOREIGN KEY(bucket,path) REFERENCES qa_pilot_app.storage_refs(bucket,path));
CREATE TABLE qa_pilot_app.message_attachments(
  id uuid PRIMARY KEY, message_id uuid NOT NULL REFERENCES qa_pilot_app.messages(id),
  bucket text NOT NULL, path text NOT NULL,
  FOREIGN KEY(bucket,path) REFERENCES qa_pilot_app.storage_refs(bucket,path));

INSERT INTO qa_pilot_auth.accounts VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','parent-a@example.invalid'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','parent-b@example.invalid');
INSERT INTO qa_pilot_app.profiles VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',NULL);
INSERT INTO qa_pilot_app.students VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','3 Primaria');
INSERT INTO qa_pilot_app.listings VALUES
 ('11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Libro de texto QA','reserved');
INSERT INTO qa_pilot_app.conversations VALUES
 ('22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO qa_pilot_app.messages VALUES
 ('33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','¿Disponible?'),
 ('44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Sí, confirmo');
INSERT INTO qa_pilot_app.listing_offers VALUES
 ('55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1500,'accepted');
INSERT INTO qa_pilot_app.agreements VALUES
 ('66666666-6666-4666-8666-666666666666',
  '55555555-5555-4555-8555-555555555555',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accepted');

"""


def snapshot(url):
    statements = (
        "select id||'|'||email from qa_pilot_auth.accounts order by id",
        "select id||'|'||coalesce(school_id::text,'') from qa_pilot_app.profiles order by id",
        "select id||'|'||owner_user_id||'|'||grade_level from qa_pilot_app.students order by id",
        "select bucket||'/'||path||'|'||owner_user_id||'|'||sha256 "
        "from qa_pilot_app.storage_refs order by bucket,path",
        "select id||'|'||seller_id||'|'||title||'|'||status from qa_pilot_app.listings order by id",
        "select id||'|'||listing_id||'|'||buyer_id||'|'||seller_id "
        "from qa_pilot_app.conversations order by id",
        "select id||'|'||conversation_id||'|'||sender_id||'|'||body "
        "from qa_pilot_app.messages order by id",
        "select id||'|'||listing_id||'|'||buyer_id||'|'||seller_id||'|'||amount_cents||'|'||status "
        "from qa_pilot_app.listing_offers order by id",
        "select id||'|'||offer_id||'|'||buyer_id||'|'||seller_id||'|'||status "
        "from qa_pilot_app.agreements order by id",
        "select id||'|'||listing_id||'|'||bucket||'/'||path "
        "from qa_pilot_app.listing_photos order by id",
        "select id||'|'||message_id||'|'||bucket||'/'||path "
        "from qa_pilot_app.message_attachments order by id",
    )
    return tuple(query(url, statement) for statement in statements)


def verify_media_ownership(database):
    """A restored photo belongs to listing seller; attachment to message author."""
    matches = (
        query(database, """SELECT count(*) FROM qa_pilot_app.listing_photos p
            JOIN qa_pilot_app.listings l ON l.id=p.listing_id
            JOIN qa_pilot_app.storage_refs s ON s.bucket=p.bucket AND s.path=p.path
            WHERE s.owner_user_id=l.seller_id"""),
        query(database, """SELECT count(*) FROM qa_pilot_app.message_attachments a
            JOIN qa_pilot_app.messages m ON m.id=a.message_id
            JOIN qa_pilot_app.storage_refs s ON s.bucket=a.bucket AND s.path=a.path
            WHERE s.owner_user_id=m.sender_id"""),
    )
    total = (
        query(database, "SELECT count(*) FROM qa_pilot_app.listing_photos"),
        query(database, "SELECT count(*) FROM qa_pilot_app.message_attachments"),
    )
    if matches != total or total != ("1", "1"):
        raise AssertionError("Recovered object owner is inconsistent with listing or message")

def verify_encrypted_checksum(source, expected):
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != expected:
        raise ValueError("Encrypted artifact checksum mismatch")


def encrypt_then_recover(plain_db, plain_storage, directory):
    # Same AES-256-CBC PBKDF2 iteration count as Wetudy's encrypted backup jobs.
    # The password exists ONLY in this one ephemeral test process.
    password = secrets.token_hex(32)
    env = dict(os.environ, WETUDY_QA_ENC_PASS=password)
    recovered = []
    for source in (plain_db, plain_storage):
        expected_plain = hashlib.sha256(source.read_bytes()).hexdigest()
        encrypted = directory / (source.name + ".enc")
        restored = directory / ("recovered-" + source.name)
        subprocess.run(
            ["openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-iter", "200000",
             "-in", str(source), "-out", str(encrypted),
             "-pass", "env:WETUDY_QA_ENC_PASS"],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            env=env, timeout=40)
        expected_digest = hashlib.sha256(encrypted.read_bytes()).hexdigest()
        assert encrypted.stat().st_size > 0 and expected_digest
        # Reject tampering BEFORE attempting decryption.
        altered = bytearray(encrypted.read_bytes())
        altered[-1] ^= 0x01
        corrupted = directory / (source.name + ".tampered.enc")
        corrupted.write_bytes(altered)
        try:
            verify_encrypted_checksum(corrupted, expected_digest)
        except ValueError:
            pass  # Required: tampering is caught before decryption.
        else:
            raise AssertionError("Tampered encrypted artifact was accepted")
        finally:
            corrupted.unlink(missing_ok=True)
        source.unlink()
        broken_env = dict(env, WETUDY_QA_ENC_PASS="definitely-wrong-qa-key")
        bad_target = directory / ("bad-" + source.name)
        wrong = subprocess.run(
            ["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "200000",
             "-in", str(encrypted), "-out", str(bad_target),
             "-pass", "env:WETUDY_QA_ENC_PASS"],
            check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            env=broken_env, timeout=40)
        if wrong.returncode == 0:
            # Rare valid padding with wrong key is NOT a successful restoration.
            if bad_target.exists() and hashlib.sha256(bad_target.read_bytes()).hexdigest() == expected_plain:
                raise AssertionError("Wrong password unexpectedly recovered encrypted bytes")
        if bad_target.exists():
            bad_target.unlink()
        verify_encrypted_checksum(encrypted, expected_digest)
        subprocess.run(
            ["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "200000",
             "-in", str(encrypted), "-out", str(restored),
             "-pass", "env:WETUDY_QA_ENC_PASS"],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            env=env, timeout=40)
        if restored.stat().st_size == 0 or hashlib.sha256(restored.read_bytes()).hexdigest() != expected_plain:
            raise AssertionError("Decrypted backup bytes do not match source")
        recovered.append(restored)
    return tuple(recovered)


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
    query(SOURCE, """INSERT INTO qa_pilot_app.listing_photos VALUES
     ('77777777-7777-4777-8777-777777777777',
      '11111111-1111-4111-8111-111111111111',
      'listing-photos','parent-a/example.webp')""")
    query(SOURCE, """INSERT INTO qa_pilot_app.message_attachments VALUES
     ('88888888-8888-4888-8888-888888888888',
      '33333333-3333-4333-8333-333333333333',
      'chat-attachments','parent-b/notice.txt')""")
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
        # Encrypt both artifacts, remove the plaintext backup copies and only
        # restore from freshly decrypted files after ciphertext hash checking.
        backup, archive = encrypt_then_recover(backup, archive, directory)
        verify_archive(archive)
        # A second, distinct LOCAL database must be created before restoration.
        query(SOURCE, "create database wetudy_pilot_dr_restored")
        try:
            run("pg_restore", "--exit-on-error", "--no-owner", "--no-acl",
                "--dbname", TARGET, str(backup))
            recovered = snapshot(TARGET)
            if recovered != original:
                raise AssertionError("Recovered PostgreSQL rows differ from source")
            if any(len(recovered[index].splitlines()) != expected for index, expected
                   in ((4,1),(5,1),(6,2),(7,1),(8,1),(9,1),(10,1))):
                raise AssertionError("Synthetic recovered marketplace chain incomplete")
            # Ensure all recovered buyer/seller and listing/offer references
            # refer to exactly the same parties and transaction.
            if query(TARGET, """SELECT count(*) FROM qa_pilot_app.agreements a
                JOIN qa_pilot_app.listing_offers o ON o.id=a.offer_id
                JOIN qa_pilot_app.listings l ON l.id=o.listing_id
                JOIN qa_pilot_app.conversations c ON c.listing_id=l.id
                WHERE a.buyer_id=o.buyer_id AND a.seller_id=o.seller_id
                  AND o.seller_id=l.seller_id AND c.buyer_id=o.buyer_id
                  AND c.seller_id=o.seller_id""") != "1":
                raise AssertionError("Recovered sale parties/relationships differ")

            verify_media_ownership(TARGET)
            # Negative controls: broken restored object ownership MUST be rejected,
            # even when the object still exists and its SHA256 happens to match.
            qa_seller = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
            qa_buyer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
            query(TARGET, "UPDATE qa_pilot_app.storage_refs SET owner_user_id='" +
                  qa_buyer + "' WHERE bucket='listing-photos'")
            try:
                try:
                    verify_media_ownership(TARGET)
                except AssertionError:
                    pass
                else:
                    raise AssertionError("Foreign-owned listing photo was accepted")
            finally:
                query(TARGET, "UPDATE qa_pilot_app.storage_refs SET owner_user_id='" +
                      qa_seller + "' WHERE bucket='listing-photos'")
            query(TARGET, "UPDATE qa_pilot_app.storage_refs SET owner_user_id='" +
                  qa_seller + "' WHERE bucket='chat-attachments'")
            try:
                try:
                    verify_media_ownership(TARGET)
                except AssertionError:
                    pass
                else:
                    raise AssertionError("Foreign-owned chat attachment was accepted")
            finally:
                query(TARGET, "UPDATE qa_pilot_app.storage_refs SET owner_user_id='" +
                      qa_buyer + "' WHERE bucket='chat-attachments'")
            verify_media_ownership(TARGET)
            if query(TARGET,"select count(*) from qa_pilot_app.profiles where school_id is not null") != "0":
                raise AssertionError("Unexpected active school membership in recovery")
            with tarfile.open(archive, "r:gz") as tar:
                for (bucket, name), original_bytes in fixtures.items():
                    member = tar.extractfile("./" + bucket + "/" + name)
                    if member is None or member.read() != original_bytes:
                        raise AssertionError("Storage object bytes changed across recovery")
            print("PASS synthetic integrated DR: two account surrogates, two profiles, "
                  "one student, listing, conversation, messages, offer, agreement and two linked storage objects; local pg_dump/pg_restore and "
                  "encrypted artifacts, object ownership consistency, tamper checks and byte-for-byte SHA256 verified.")
            print("LIMIT: synthetic account surrogates are NOT Supabase GoTrue users; "
                  "this is NOT a full hosted Auth/DB/Storage restore.")
        finally:
            query(SOURCE, "drop database if exists wetudy_pilot_dr_restored with (force)")


if __name__ == "__main__":
    main()
