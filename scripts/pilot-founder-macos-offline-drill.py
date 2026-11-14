#!/usr/bin/env python3
"""Offline macOS Big Sur backup verification. No Docker, Homebrew or network.
Requires cryptography 48.0.1 in local venv. No PostgreSQL restore or GO claim.
"""
import argparse
from contextlib import redirect_stdout
import getpass
import io
import json
from pathlib import Path
import runpy
import sys
import tempfile
import zipfile
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.padding import PKCS7

HERE=Path(__file__).resolve().parent
PREFLIGHT=runpy.run_path(str(HERE/"pilot-founder-local-backup-preflight.py"))
STORAGE=runpy.run_path(str(HERE/"verify-pilot-storage-restore.py"))
ACL=runpy.run_path(str(HERE/"pilot-backup-acl-snapshot-validate.py"))
MAX_CIPHER_BYTES=2*1024**3

def decrypt_from_zip(zip_path,member_name,password,destination):
    """OpenSSL enc -aes-256-cbc -pbkdf2 -iter 200000 salted format.
    Key||IV derived with PBKDF2-HMAC-SHA256, 48 bytes, 8-byte salt.
    Caller MUST SHA256-preflight full archive before calling.
    """
    with zipfile.ZipFile(zip_path) as archive:
        matches=[info for info in archive.infolist()
                 if info.filename in (member_name,"backup/"+member_name)]
        if len(matches)!=1 or matches[0].file_size>MAX_CIPHER_BYTES:
            raise ValueError("Missing, duplicate or oversized encrypted member")
        with archive.open(matches[0]) as encrypted:
            header=encrypted.read(16)
            if len(header)!=16 or header[:8]!=b"Salted__":
                raise ValueError("Invalid encrypted member header")
            kdf=PBKDF2HMAC(algorithm=SHA256(),length=48,salt=header[8:],
                           iterations=200000)
            key_iv=kdf.derive(password.encode("utf-8"))
            dec=Cipher(algorithms.AES(key_iv[:32]),modes.CBC(key_iv[32:])).decryptor()
            unpad=PKCS7(128).unpadder()
            size=0
            with destination.open("xb") as out:
                while chunk:=encrypted.read(1024*1024):
                    clear=unpad.update(dec.update(chunk))
                    size+=len(clear)
                    if size>MAX_CIPHER_BYTES:
                        raise ValueError("Decrypted output exceeds safety bound")
                    out.write(clear)
                clear=unpad.update(dec.finalize())+unpad.finalize()
                size+=len(clear)
                if size>MAX_CIPHER_BYTES:
                    raise ValueError("Decrypted output exceeds safety bound")
                out.write(clear)
    destination.chmod(0o600)
    return size

def run(db_zip,storage_zip,password):
    evidence=PREFLIGHT["run"](db_zip,storage_zip)
    if not password: raise ValueError("Empty passphrase")
    with tempfile.TemporaryDirectory(prefix="wetudy-mac-private-") as directory:
        root=Path(directory)
        root.chmod(0o700)
        dump=root/"postgres.dump"
        tar=root/"storage.tar.gz"
        decrypt_from_zip(db_zip,"wetudy.dump.enc",password,dump)
        decrypt_from_zip(storage_zip,"wetudy-storage.tar.gz.enc",password,tar)
        with dump.open("rb") as stream:
            if stream.read(5)!=b"PGDMP":
                raise ValueError("Not a PostgreSQL custom dump")
        with redirect_stdout(io.StringIO()) as captured:
            STORAGE["validate_archive"](str(tar))
        if "Storage offline recovery PASS:" not in captured.getvalue():
            raise ValueError("Storage verification did not succeed")
        acl_pass=False
        if evidence["database"]["acl_snapshot_included"]:
            acl=root/"acl.json"
            decrypt_from_zip(db_zip,"wetudy-acl-snapshot.json.enc",password,acl)
            if acl.stat().st_size>8*1024*1024:
                raise ValueError("Oversized ACL")
            with acl.open("r",encoding="utf-8") as stream:
                ACL["validate"](json.load(stream))
            acl_pass=True
    return {"encrypted_zip_sha256":True,
            "postgres_custom_dump_header":True,
            "storage_object_hashes":True,
            "acl_snapshot_validated":acl_pass,
            "full_database_restore":False,
            "auth_runtime_verified":False,
            "production_modified":False}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--database-zip",required=True)
    p.add_argument("--storage-zip",required=True)
    p.add_argument("--confirm-decrypt-locally",action="store_true")
    args=p.parse_args()
    if not args.confirm_decrypt_locally:
        p.error("Explicit --confirm-decrypt-locally required")
    try:
        password=getpass.getpass("Local encryption password (not shared): ")
        outcome=run(args.database_zip,args.storage_zip,password)
    except (OSError,ValueError,UnicodeError,RuntimeError,zipfile.BadZipFile,
            json.JSONDecodeError) as exc:
        print("NO_GO_MAC_OFFLINE_DRILL: "+type(exc).__name__,file=sys.stderr)
        return 2
    finally:
        if "password" in locals(): password=None
    print("PASS_MAC_OFFLINE_DRILL: encrypted SHA256, PostgreSQL dump header, Storage object hashes")
    for key,value in outcome.items(): print(key+": "+str(value))
    print("NOT_CERTIFIED: DB/ACL replay, pg_restore TOC, GoTrue/Auth runtime, Storage API, RTO/RPO.")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
